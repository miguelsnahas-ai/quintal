"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireOperator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  return supabase;
}

export async function toggleMessageHandled(formData: FormData) {
  const supabase = await requireOperator();
  const messageId = String(formData.get("message_id") ?? "");
  const wasHandled = formData.get("was_handled") === "true";

  const { error } = await supabase
    .from("messages")
    .update({ handled_at: wasHandled ? null : new Date().toISOString() })
    .eq("id", messageId);

  if (error) {
    redirect(`/ops/inbox?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/ops/inbox");
  redirect("/ops/inbox");
}

export async function linkMessageToFamily(formData: FormData) {
  const supabase = await requireOperator();
  const messageId = String(formData.get("message_id") ?? "");
  const familyId = String(formData.get("family_id") ?? "");

  if (!familyId) {
    redirect(`/ops/inbox?error=${encodeURIComponent("Selecione uma família.")}`);
  }

  const { error } = await supabase
    .from("messages")
    .update({ family_id: familyId })
    .eq("id", messageId);

  if (error) {
    redirect(`/ops/inbox?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/ops/inbox");
  redirect("/ops/inbox");
}
