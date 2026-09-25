import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { suggestEventFromMessage } from "@/lib/groq/suggestEvent";
import { suggestReply } from "@/lib/groq/suggestReply";
import { getChildContext } from "@/lib/childContext";
import { recommendActivity, type RecommendationResult } from "@/lib/recommendation";
import type { ActivitySummary } from "@/lib/activity";
import { eventTypeLabels, type EventType } from "@/lib/validation/events";
import type { Database, Json } from "@/lib/supabase/types";

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

// Shared by the authenticated playground (/ops/playground), the public
// test-user chat (/test/[caregiverId]) and the real product experience
// (/quintal) — same recording logic, just called with a different
// Supabase client (session-scoped vs. service-role) and a different
// `source` tag on raw_payload for auditing.
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
    // docs/ARCHITECTURE_TARGET.md.
    supabase
      .from("messages")
      .select("direction, body")
      .eq("family_id", caregiver.family_id)
      .not("body", "is", null)
      .order("created_at", { ascending: false })
      .limit(RECENT_MESSAGES_LIMIT),
  ]);

  const recentMessages = (recentMessagesRaw ?? [])
    .reverse()
    .map((message) => ({ direction: message.direction, body: message.body! }));

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

  // The Recommendation Engine (src/lib/recommendation.ts) decides, on its
  // own, whether this message is a situation worth recommending an
  // activity for. suggestEventFromMessage runs alongside it (independent
  // question, same raw message); suggestReply only runs afterward, and
  // only when the recommendation engine says this turn isn't one of its
  // situations — see docs/ARCHITECTURE_TARGET.md, "Recommendation Engine
  // (Fase 5)" for why these aren't both run unconditionally.
  const [suggestion, recommendation] = await Promise.all([
    suggestEventFromMessage({
      messageBody: input.messageBody,
      childContext,
    }).catch(() => null),
    recommendActivity({
      childContext,
      situation: input.messageBody,
      recentConversation: recentMessages,
    }).catch((): RecommendationResult => ({ kind: "none" })),
  ]);

  let reply: string;
  let activity: ActivitySummary | null = null;

  if (recommendation.kind === "activity") {
    reply = recommendation.reason;
    activity = recommendation.activity;
  } else if (recommendation.kind === "clarify") {
    reply = recommendation.question;
  } else {
    const replySuggestion = await suggestReply({
      messageBody: input.messageBody,
      childContext,
      recentMessages,
    });
    reply = replySuggestion.text;
  }

  // Auto-recorded only when the classifier is confident this message
  // describes something concrete (see suggestEventFromMessage's
  // isConcreteEvent) — this path has no human reviewing the suggestion
  // before it's saved, unlike the inbox triage flow, so a vague/generic
  // message (a greeting, a question) is deliberately left unlogged rather
  // than polluting the child's event history.
  let recordedEventTypeLabel: string | null = null;
  if (suggestion?.isConcreteEvent && input.childId) {
    const { error: eventError } = await supabase.from("events").insert({
      child_id: input.childId,
      type: suggestion.type,
      notes: suggestion.notes,
      source_message_id: inboundMessage.id,
    });

    if (eventError) {
      console.error("Failed to auto-record event from conversation", eventError);
    } else {
      recordedEventTypeLabel = eventTypeLabels[suggestion.type as EventType];
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
    raw_payload: { simulated: true, source: input.source } as Json,
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
  };
}
