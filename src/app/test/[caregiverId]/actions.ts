"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { recordConversationTurn } from "@/lib/conversation";
import { submitRecommendationFeedback, type RecommendationFeedback } from "@/lib/recommendation";
import type { ConversationTurn } from "@/components/conversation/ConversationChat";
import type { ActivitySummary } from "@/lib/activity";

// No auth gate by design — this is the link a test caregiver opens on
// their own phone/browser. It's scoped strictly to the caregiverId in the
// URL (an unguessable UUID) and never exposes data from any other family.
// This is an accepted tradeoff for an internal QA/pilot-link tool, not the
// real product's access model — see /quintal for that (session-based,
// documented in docs/ARCHITECTURE_TARGET.md).
export async function sendTestMessage(
  caregiverId: string,
  input: {
    childId: string | null;
    history: ConversationTurn[];
  },
): Promise<{ reply: string; activity: ActivitySummary | null; recommendationId: string | null }> {
  const supabase = createServiceClient();

  const lastUserMessage = [...input.history].reverse().find((turn) => turn.role === "user");
  if (!lastUserMessage) {
    throw new Error("Nenhuma mensagem para responder.");
  }

  const { data: caregiver } = await supabase
    .from("caregivers")
    .select("id")
    .eq("id", caregiverId)
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
      .eq("id", caregiverId)
      .single();
    if (!child || child.family_id !== caregiverFamily?.family_id) {
      childId = null;
    }
  }

  const { reply, activity, recommendationId } = await recordConversationTurn(supabase, {
    caregiverId,
    childId,
    messageBody: lastUserMessage.content,
    source: "test-link",
  });

  return { reply, activity, recommendationId };
}

// Same reasoning as sendQuintalRecommendationFeedback (/quintal/actions.ts):
// a thin, ungated wrapper around the shared feedback recorder.
export async function sendTestRecommendationFeedback(input: {
  recommendationId: string;
  feedback: RecommendationFeedback;
  note?: string;
}): Promise<void> {
  await submitRecommendationFeedback(input);
}
