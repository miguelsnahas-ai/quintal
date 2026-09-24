"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { eventInputSchema } from "@/lib/validation/events";
import { suggestEventFromMessage, type EventSuggestion } from "@/lib/groq/suggestEvent";
import { suggestReply } from "@/lib/groq/suggestReply";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp/send";
import { getChildContext } from "@/lib/childContext";
import { RECENT_MESSAGES_LIMIT } from "@/lib/conversation";
import type { Json } from "@/lib/supabase/types";

export async function createEventFromMessage(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const messageId = String(formData.get("message_id") ?? "");

  const parsed = eventInputSchema.safeParse({
    child_id: formData.get("child_id"),
    type: formData.get("type"),
    occurred_at: formData.get("occurred_at"),
    notes: formData.get("notes"),
    source_message_id: messageId,
  });

  if (!parsed.success) {
    redirect(
      `/ops/inbox/${messageId}?error=${encodeURIComponent(parsed.error.issues[0].message)}`,
    );
  }

  const { error: eventError } = await supabase.from("events").insert({
    child_id: parsed.data.child_id,
    type: parsed.data.type,
    notes: parsed.data.notes,
    occurred_at: new Date(parsed.data.occurred_at).toISOString(),
    source_message_id: parsed.data.source_message_id,
    created_by: user.id,
  });

  if (eventError) {
    redirect(`/ops/inbox/${messageId}?error=${encodeURIComponent(eventError.message)}`);
  }

  // Best-effort: the event is already saved either way, so a failure here
  // shouldn't block the operator — just leaves the message showing as
  // untreated, which is safe (worst case they re-open and toggle it).
  await supabase
    .from("messages")
    .update({ handled_at: new Date().toISOString() })
    .eq("id", messageId);

  revalidatePath("/ops/inbox");
  redirect("/ops/inbox");
}

export async function suggestEvent(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const messageId = String(formData.get("message_id") ?? "");
  const childId = String(formData.get("child_id") ?? "");
  const messageBody = String(formData.get("message_body") ?? "");

  // The redirect below must happen outside this try/catch: redirect()
  // works by throwing, and a catch here would otherwise treat a
  // successful redirect as a failed suggestion.
  let suggestion: EventSuggestion | null = null;
  let errorMessage: string | null = null;

  try {
    const childContext = childId ? await getChildContext(supabase, childId) : null;
    suggestion = await suggestEventFromMessage({ messageBody, childContext });
  } catch (err) {
    console.error("OpenAI event suggestion failed", err);
    errorMessage = "Não foi possível gerar a sugestão. Tente novamente ou preencha manualmente.";
  }

  const params = new URLSearchParams({ child_id: childId });
  if (suggestion) {
    params.set("suggested_type", suggestion.type);
    params.set("suggested_notes", suggestion.notes);
  }
  if (errorMessage) {
    params.set("error", errorMessage);
  }

  redirect(`/ops/inbox/${messageId}?${params.toString()}`);
}

export async function suggestReplyDraft(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const messageId = String(formData.get("message_id") ?? "");
  const childId = formData.get("child_id") ? String(formData.get("child_id")) : null;
  const messageBody = String(formData.get("message_body") ?? "");

  const childContext = childId ? await getChildContext(supabase, childId) : null;

  let recentMessages: { direction: string; body: string }[] = [];
  const { data: currentMessage } = await supabase
    .from("messages")
    .select("family_id")
    .eq("id", messageId)
    .maybeSingle();
  if (currentMessage?.family_id) {
    const { data: messages } = await supabase
      .from("messages")
      .select("direction, body")
      .eq("family_id", currentMessage.family_id)
      .neq("id", messageId)
      .not("body", "is", null)
      .order("created_at", { ascending: false })
      .limit(RECENT_MESSAGES_LIMIT);
    recentMessages = (messages ?? [])
      .reverse()
      .map((message) => ({ direction: message.direction, body: message.body! }));
  }

  // Same reasoning as suggestEvent above: redirect() must stay outside
  // this try/catch.
  let draft: string | null = null;
  let errorMessage: string | null = null;

  try {
    draft = await suggestReply({
      messageBody,
      childContext,
      recentMessages,
    });
  } catch (err) {
    console.error("OpenAI reply suggestion failed", err);
    errorMessage = "Não foi possível gerar a sugestão de resposta. Escreva manualmente.";
  }

  const params = new URLSearchParams();
  if (childId) params.set("child_id", childId);
  if (draft) params.set("draft_reply", draft);
  if (errorMessage) params.set("error", errorMessage);

  const query = params.toString();
  redirect(`/ops/inbox/${messageId}${query ? `?${query}` : ""}`);
}

export async function sendReply(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const messageId = String(formData.get("message_id") ?? "");
  const toPhoneNumber = String(formData.get("to_phone_number") ?? "");
  const familyId = formData.get("family_id") ? String(formData.get("family_id")) : null;
  const caregiverId = formData.get("caregiver_id") ? String(formData.get("caregiver_id")) : null;
  const body = String(formData.get("reply_body") ?? "").trim();

  if (!body) {
    redirect(`/ops/inbox/${messageId}?error=${encodeURIComponent("Escreva algo antes de enviar.")}`);
  }

  // Same reasoning as suggestEvent above: redirect() must stay outside
  // this try/catch.
  let sendResult: { waMessageId: string; raw: unknown } | null = null;
  let errorMessage: string | null = null;

  try {
    sendResult = await sendWhatsAppTextMessage({ to: toPhoneNumber, body });
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Falha ao enviar a mensagem.";
  }

  if (!sendResult) {
    redirect(
      `/ops/inbox/${messageId}?error=${encodeURIComponent(errorMessage ?? "Falha ao enviar a mensagem.")}`,
    );
  }

  const { error: insertError } = await supabase.from("messages").insert({
    family_id: familyId,
    caregiver_id: caregiverId,
    wa_message_id: sendResult.waMessageId,
    from_phone_number: toPhoneNumber,
    direction: "outbound",
    message_type: "text",
    body,
    raw_payload: sendResult.raw as Json,
    wa_timestamp: new Date().toISOString(),
    in_reply_to_message_id: messageId,
  });

  if (insertError) {
    // The reply already went out on WhatsApp — surfacing this as a send
    // failure would be misleading to the operator. Log it for follow-up;
    // the family got the message either way.
    console.error("Reply sent but failed to record it in messages", insertError);
  }

  await supabase
    .from("messages")
    .update({ handled_at: new Date().toISOString() })
    .eq("id", messageId)
    .is("handled_at", null);

  revalidatePath("/ops/inbox");
  redirect(`/ops/inbox/${messageId}?sent=1`);
}

export async function recordReplyFeedback(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const messageId = String(formData.get("message_id") ?? "");
  const replyMessageId = String(formData.get("reply_message_id") ?? "");
  const helpful = formData.get("helpful") === "true";
  const feedbackNotesRaw = formData.get("feedback_notes");
  const feedbackNotes =
    feedbackNotesRaw && String(feedbackNotesRaw).trim() ? String(feedbackNotesRaw).trim() : null;

  const { error } = await supabase
    .from("messages")
    .update({
      helpful,
      feedback_notes: feedbackNotes,
      feedback_recorded_at: new Date().toISOString(),
    })
    .eq("id", replyMessageId);

  if (error) {
    redirect(`/ops/inbox/${messageId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/ops/inbox/${messageId}`);
  redirect(`/ops/inbox/${messageId}`);
}
