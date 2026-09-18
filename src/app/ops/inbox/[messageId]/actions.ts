"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { eventInputSchema } from "@/lib/validation/events";

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
