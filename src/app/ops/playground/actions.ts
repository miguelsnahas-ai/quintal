"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { recordConversationTurn } from "@/lib/conversation";
import type { ActivitySummary } from "@/lib/activity";

export type PlaygroundTurn = {
  role: "user" | "assistant";
  content: string;
  eventTypeLabel?: string;
};

export async function sendPlaygroundMessage(input: {
  caregiverId: string;
  childId: string | null;
  history: PlaygroundTurn[];
}): Promise<{
  eventTypeLabel: string | null;
  reply: string;
  inboundMessageId: string;
  activity: ActivitySummary | null;
}> {
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

  return recordConversationTurn(supabase, {
    caregiverId: input.caregiverId,
    childId: input.childId,
    messageBody: lastUserMessage.content,
    source: "playground",
  });
}
