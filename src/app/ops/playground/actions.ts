"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { suggestEventFromMessage } from "@/lib/groq/suggestEvent";
import { suggestReply } from "@/lib/groq/suggestReply";
import { eventTypeLabels, type EventType } from "@/lib/validation/events";

export type PlaygroundTurn = {
  role: "user" | "assistant";
  content: string;
  eventTypeLabel?: string;
};

export async function generatePlaygroundReply(input: {
  childName: string;
  childAge: string;
  history: PlaygroundTurn[];
}): Promise<{ eventTypeLabel: string | null; reply: string }> {
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

  const childName = input.childName.trim() || "Criança de teste";
  const childAge = input.childAge.trim() || null;

  const [suggestion, reply] = await Promise.all([
    suggestEventFromMessage({
      messageBody: lastUserMessage.content,
      childName,
      childAge,
    }).catch(() => null),
    suggestReply({
      messageBody: lastUserMessage.content,
      childName,
      childAge,
      recentEvents: [],
    }),
  ]);

  return {
    eventTypeLabel: suggestion ? eventTypeLabels[suggestion.type as EventType] : null,
    reply,
  };
}
