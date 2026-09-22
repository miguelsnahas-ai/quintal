"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setCustomInstructions } from "@/lib/ai-settings";

export type MonitorMessage = {
  id: string;
  direction: string;
  body: string | null;
  created_at: string;
  wa_message_id: string;
};

export async function getConversation(caregiverId: string): Promise<MonitorMessage[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("messages")
    .select("id, direction, body, created_at, wa_message_id")
    .eq("caregiver_id", caregiverId)
    .order("created_at", { ascending: true });

  return data ?? [];
}

export async function updatePromptInstructions(customInstructions: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  await setCustomInstructions(customInstructions, user.id);
}
