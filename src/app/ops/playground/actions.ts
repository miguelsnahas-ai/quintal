"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { suggestEventFromMessage } from "@/lib/groq/suggestEvent";
import { suggestReply } from "@/lib/groq/suggestReply";
import { eventTypeLabels, type EventType } from "@/lib/validation/events";
import { ageLabel } from "@/lib/format";
import type { Json } from "@/lib/supabase/types";

export type PlaygroundTurn = {
  role: "user" | "assistant";
  content: string;
  eventTypeLabel?: string;
};

export async function sendPlaygroundMessage(input: {
  caregiverId: string;
  childId: string | null;
  history: PlaygroundTurn[];
}): Promise<{ eventTypeLabel: string | null; reply: string; inboundMessageId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const lastUserMessage = [...input.history].reverse().find((turn) => turn.role === "user");
  if (!lastUserMessage) {
    throw new Error("Nenhuma mensagem para responder.");
  }

  const { data: caregiver, error: caregiverError } = await supabase
    .from("caregivers")
    .select("id, family_id, phone_number")
    .eq("id", input.caregiverId)
    .maybeSingle();

  if (caregiverError || !caregiver) {
    throw new Error("Cuidador não encontrado.");
  }

  const { data: child } = input.childId
    ? await supabase
        .from("children")
        .select("id, name, birth_date")
        .eq("id", input.childId)
        .maybeSingle()
    : { data: null };

  const childName = child?.name ?? null;
  const childAge = child ? ageLabel(child.birth_date) : null;

  const { data: recentEventsRaw } = child
    ? await supabase
        .from("events")
        .select("type, notes, occurred_at")
        .eq("child_id", child.id)
        .order("occurred_at", { ascending: false })
        .limit(10)
    : { data: null };

  const recentEvents = (recentEventsRaw ?? []).map((event) => ({
    type: event.type,
    notes: event.notes,
    occurredAt: event.occurred_at,
  }));

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
      body: lastUserMessage.content,
      raw_payload: { simulated: true, source: "playground" } as Json,
      wa_timestamp: new Date().toISOString(),
      family_id: caregiver.family_id,
      caregiver_id: caregiver.id,
    })
    .select("id")
    .single();

  if (inboundError || !inboundMessage) {
    throw new Error(inboundError?.message ?? "Falha ao registrar a mensagem.");
  }

  const [suggestion, reply] = await Promise.all([
    suggestEventFromMessage({
      messageBody: lastUserMessage.content,
      childName: childName ?? "Criança não identificada",
      childAge,
    }).catch(() => null),
    suggestReply({
      messageBody: lastUserMessage.content,
      childName,
      childAge,
      recentEvents,
    }),
  ]);

  // Auto-saved as a real outbound record by design: this chat is meant to
  // flow like a live conversation. Nothing here calls the WhatsApp Cloud
  // API — it only writes to our own database.
  const { error: outboundError } = await supabase.from("messages").insert({
    wa_message_id: `sim-${randomUUID()}`,
    from_phone_number: caregiver.phone_number,
    direction: "outbound",
    message_type: "text",
    body: reply,
    raw_payload: { simulated: true, source: "playground" } as Json,
    wa_timestamp: new Date().toISOString(),
    family_id: caregiver.family_id,
    caregiver_id: caregiver.id,
    in_reply_to_message_id: inboundMessage.id,
  });

  if (outboundError) {
    console.error("Failed to record playground reply", outboundError);
  }

  await supabase
    .from("messages")
    .update({ handled_at: new Date().toISOString() })
    .eq("id", inboundMessage.id);

  return {
    eventTypeLabel: suggestion ? eventTypeLabels[suggestion.type as EventType] : null,
    reply,
    inboundMessageId: inboundMessage.id,
  };
}
