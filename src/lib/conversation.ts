import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { suggestEventFromMessage } from "@/lib/groq/suggestEvent";
import { suggestReply } from "@/lib/groq/suggestReply";
import { extractChatAction } from "@/lib/groq/extractAction";
import { getChildContext } from "@/lib/childContext";
import { recommendActivity, type RecommendationResult } from "@/lib/recommendation";
import {
  dispatchChatAction,
  applyConfirmedAction,
  matchesAffirmativeConfirmation,
  type DispatchOutcome,
} from "@/lib/chatActions";
import { chatActionSchema, type ChatAction } from "@/lib/validation/chatAction";
import type { ActivitySummary } from "@/lib/activity";
import { eventTypeLabels, type EventType } from "@/lib/validation/events";
import type { Database, Json } from "@/lib/supabase/types";

// Lê a ação pendente (se houver) deixada pela última mensagem de SAÍDA
// da família — ver o comentário sobre confirmação entre turnos em
// src/lib/chatActions.ts. raw_payload é jsonb solto, nunca confiamos
// nele sem revalidar contra chatActionSchema.
function extractPendingAction(rawPayload: Json | null | undefined): ChatAction | null {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) return null;
  const candidate = (rawPayload as Record<string, unknown>).pendingAction;
  if (!candidate) return null;
  const parsed = chatActionSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function replyFromOutcome(outcome: DispatchOutcome, fallback: string): string {
  return outcome.status === "not_applicable" ? fallback : outcome.reply;
}

export type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
  eventTypeLabel?: string;
};

// How many recent family messages count as conversational "histórico" —
// distinct from ChildContext's own limits (see src/lib/childContext.ts),
// since messages have no child_id in the current schema and are
// inherently family-scoped, not child-scoped. Shared with the inbox
// triage's own suggestReplyDraft action so both call sites agree on the
// same window.
export const RECENT_MESSAGES_LIMIT = 8;

// Shared by the public test-user chat (/test/[caregiverId]) and the real
// product experience (/quintal) — same recording logic, just called with
// a different Supabase client (session-scoped vs. service-role) and a
// different `source` tag on raw_payload for auditing. (Refatoração do
// /ops: o "chat de teste" autenticado que também chamava isto,
// /ops/playground, foi removido — redundante com estes dois.)
export async function recordConversationTurn(
  supabase: SupabaseClient<Database>,
  input: {
    caregiverId: string;
    childId: string | null;
    messageBody: string;
    source: string;
  },
): Promise<{
  eventTypeLabel: string | null;
  reply: string;
  inboundMessageId: string;
  activity: ActivitySummary | null;
  recommendationId: string | null;
}> {
  const { data: caregiver, error: caregiverError } = await supabase
    .from("caregivers")
    .select("id, family_id, phone_number")
    .eq("id", input.caregiverId)
    .maybeSingle();

  if (caregiverError || !caregiver) {
    throw new Error("Cuidador não encontrado.");
  }

  const [childContext, { data: recentMessagesRaw }] = await Promise.all([
    input.childId ? getChildContext(supabase, input.childId) : Promise.resolve(null),
    // Fetched before this turn's inbound row is inserted below, so this is
    // exactly "the conversation so far" — no need to exclude the current
    // message from the window. Scoped by family, not by child: `messages`
    // has no child_id column, so in a family with more than one child this
    // window can include messages about a sibling — see
    // docs/ARCHITECTURE_TARGET.md. raw_payload is fetched too (Fase 15):
    // it's where a pending chat-action confirmation question (if any)
    // travels between turns — see extractPendingAction above.
    supabase
      .from("messages")
      .select("direction, body, raw_payload")
      .eq("family_id", caregiver.family_id)
      .not("body", "is", null)
      .order("created_at", { ascending: false })
      .limit(RECENT_MESSAGES_LIMIT),
  ]);

  const recentRowsDesc = recentMessagesRaw ?? [];
  const recentMessages = recentRowsDesc
    .slice()
    .reverse()
    .map((message) => ({ direction: message.direction, body: message.body! }));

  // O turno anterior do Quintal — se ele deixou uma ação pendente (ver
  // chatActions.ts, "Confirmação entre turnos"), é contra ELA que a
  // mensagem atual pode estar confirmando, não uma nova extração.
  const pendingAction = extractPendingAction(
    recentRowsDesc.find((row) => row.direction === "outbound")?.raw_payload,
  );

  // Real inbound record — same shape the WhatsApp webhook would produce,
  // marked "sim-" so it's flagged as not having come through the real
  // WhatsApp channel (consistent with the inbox/triage "simulação" badge).
  const { data: inboundMessage, error: inboundError } = await supabase
    .from("messages")
    .insert({
      wa_message_id: `sim-${randomUUID()}`,
      from_phone_number: caregiver.phone_number,
      direction: "inbound",
      message_type: "text",
      body: input.messageBody,
      raw_payload: { simulated: true, source: input.source } as Json,
      wa_timestamp: new Date().toISOString(),
      family_id: caregiver.family_id,
      caregiver_id: caregiver.id,
    })
    .select("id")
    .single();

  if (inboundError || !inboundMessage) {
    throw new Error(inboundError?.message ?? "Falha ao registrar a mensagem.");
  }

  let reply: string;
  let activity: ActivitySummary | null = null;
  let recommendationId: string | null = null;
  let recordedEventTypeLabel: string | null = null;
  // Quando esta ação fica pendente (precisa de confirmação — ver
  // chatActions.ts), ela é gravada em raw_payload da mensagem de saída
  // logo abaixo, para o próximo turno conseguir lê-la de volta.
  let outgoingPendingAction: ChatAction | null = null;

  const dispatchCtx = {
    childId: input.childId,
    familyId: caregiver.family_id,
    caregiverId: caregiver.id,
    childContext,
    origin: "chat" as const,
    sourceMessageId: inboundMessage.id,
  };

  if (pendingAction && matchesAffirmativeConfirmation(input.messageBody)) {
    // Turno de confirmação (Fase 15) — nunca roda a Recommendation Engine
    // nem uma nova extração: reexecuta exatamente a ação que ficou
    // pendente do turno anterior (ver applyConfirmedAction).
    const outcome = await applyConfirmedAction(pendingAction, dispatchCtx);
    reply = replyFromOutcome(
      outcome,
      "Combinado! Mas não consegui confirmar esse registro agora — pode me contar de novo com mais detalhes?",
    );
    if (outcome.status === "recorded" && outcome.eventType) {
      recordedEventTypeLabel = eventTypeLabels[outcome.eventType];
    }
  } else {
    // The Recommendation Engine (src/lib/recommendation.ts) decides, on
    // its own, whether this message is a situation worth recommending an
    // activity for. extractChatAction (Fase 15) runs alongside it —
    // independent question, same raw message: "isto pede pra eu
    // registrar/consultar/atualizar algo estruturado?". Se a
    // Recommendation Engine decidir "activity"/"clarify", essa resposta
    // sempre vence — a ação estruturada extraída em paralelo é
    // descartada, nunca as duas coisas de uma vez.
    const [recommendation, action] = await Promise.all([
      recommendActivity({
        childContext,
        situation: input.messageBody,
        recentConversation: recentMessages,
        sourceMessageId: inboundMessage.id,
      }).catch((): RecommendationResult => ({ kind: "none" })),
      extractChatAction({
        messageBody: input.messageBody,
        childContext,
        recentMessages,
      }).catch((): ChatAction => ({ type: "NONE" })),
    ]);

    if (recommendation.kind === "activity") {
      reply = recommendation.reason;
      activity = recommendation.activity;
      recommendationId = recommendation.recommendationId;
    } else if (recommendation.kind === "clarify") {
      reply = recommendation.question;
    } else {
      const outcome = action.type === "NONE" ? ({ status: "not_applicable" } as const) : await dispatchChatAction(action, dispatchCtx);

      if (outcome.status !== "not_applicable") {
        reply = outcome.reply;
        if (outcome.status === "recorded" && outcome.eventType) {
          recordedEventTypeLabel = eventTypeLabels[outcome.eventType];
        } else if (outcome.status === "needs_confirmation") {
          outgoingPendingAction = outcome.pendingAction;
        }
      } else {
        // Nem a Recommendation Engine nem a extração de ação reconheceram
        // nada nesta mensagem — comportamento idêntico ao que existia
        // antes da Fase 15: classificação grosseira (tipo + notas) com
        // auto-registro só quando isConcreteEvent, e a resposta
        // conversacional genérica.
        const [suggestion, replySuggestion] = await Promise.all([
          suggestEventFromMessage({ messageBody: input.messageBody, childContext }).catch(() => null),
          suggestReply({ messageBody: input.messageBody, childContext, recentMessages }),
        ]);
        reply = replySuggestion.text;

        if (suggestion?.isConcreteEvent && input.childId) {
          const { error: eventError } = await supabase.from("events").insert({
            child_id: input.childId,
            type: suggestion.type,
            notes: suggestion.notes,
            source_message_id: inboundMessage.id,
            origin: "chat",
            caregiver_id: caregiver.id,
          });

          if (eventError) {
            console.error("Failed to auto-record event from conversation", eventError);
          } else {
            recordedEventTypeLabel = eventTypeLabels[suggestion.type as EventType];
          }
        }
      }
    }
  }

  // Auto-saved as a real outbound record by design: this chat is meant to
  // flow like a live conversation. Nothing here calls the WhatsApp Cloud
  // API — it only writes to our own database.
  const { error: outboundError } = await supabase.from("messages").insert({
    wa_message_id: `sim-${randomUUID()}`,
    from_phone_number: caregiver.phone_number,
    direction: "outbound",
    message_type: "text",
    body: reply,
    activity_id: activity?.id ?? null,
    raw_payload: {
      simulated: true,
      source: input.source,
      // Lido de volta no próximo turno por extractPendingAction, acima —
      // ver "Confirmação entre turnos" em src/lib/chatActions.ts.
      ...(outgoingPendingAction ? { pendingAction: outgoingPendingAction } : {}),
    } as Json,
    wa_timestamp: new Date().toISOString(),
    family_id: caregiver.family_id,
    caregiver_id: caregiver.id,
    in_reply_to_message_id: inboundMessage.id,
  });

  if (outboundError) {
    console.error("Failed to record conversation reply", outboundError);
  }

  await supabase
    .from("messages")
    .update({ handled_at: new Date().toISOString() })
    .eq("id", inboundMessage.id);

  return {
    eventTypeLabel: recordedEventTypeLabel,
    reply,
    inboundMessageId: inboundMessage.id,
    activity,
    recommendationId,
  };
}
