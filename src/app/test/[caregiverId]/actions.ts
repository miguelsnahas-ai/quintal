"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { recordConversationTurn } from "@/lib/conversation";

export type TestChatTurn = {
  role: "user" | "assistant";
  content: string;
};

// No auth gate by design — this is the link a test caregiver opens on
// their own phone/browser. It's scoped strictly to the caregiverId in the
// URL (an unguessable UUID) and never exposes data from any other family.
export async function sendTestMessage(input: {
  caregiverId: string;
  childId: string | null;
  history: TestChatTurn[];
}): Promise<{ reply: string }> {
  const supabase = createServiceClient();

  const lastUserMessage = [...input.history].reverse().find((turn) => turn.role === "user");
  if (!lastUserMessage) {
    throw new Error("Nenhuma mensagem para responder.");
  }

  const { data: caregiver } = await supabase
    .from("caregivers")
    .select("id")
    .eq("id", input.caregiverId)
    .maybeSingle();

  if (!caregiver) {
    throw new Error("Link inválido.");
  }

  // Guard against a childId that belongs to a different family being
  // passed in — recordConversationTurn trusts childId as-is, so verify it
  // here since this endpoint has no session to rely on otherwise.
  let childId = input.childId;
  if (childId) {
    const { data: child } = await supabase
      .from("children")
      .select("id, family_id")
      .eq("id", childId)
      .maybeSingle();
    const { data: caregiverFamily } = await supabase
      .from("caregivers")
      .select("family_id")
      .eq("id", input.caregiverId)
      .single();
    if (!child || child.family_id !== caregiverFamily?.family_id) {
      childId = null;
    }
  }

  const { reply } = await recordConversationTurn(supabase, {
    caregiverId: input.caregiverId,
    childId,
    messageBody: lastUserMessage.content,
    source: "test-link",
  });

  return { reply };
}
