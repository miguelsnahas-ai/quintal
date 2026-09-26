"use server";

import { getFamilySessionCaregiverId } from "@/lib/familySession";
import { createServiceClient } from "@/lib/supabase/service";
import { recordConversationTurn } from "@/lib/conversation";
import { submitRecommendationFeedback, type RecommendationFeedback } from "@/lib/recommendation";
import type { ConversationTurn } from "@/components/conversation/ConversationChat";
import type { ActivitySummary } from "@/lib/activity";

// This is the real product's send path. Unlike /test's action, the
// caregiverId is never taken from the client — it's resolved here from
// the httpOnly session cookie, so tampering with anything the browser
// sends can't make this act as a different family. See
// docs/ARCHITECTURE_TARGET.md for the reasoning behind this session model.
export async function sendQuintalMessage(input: {
  childId: string | null;
  history: ConversationTurn[];
}): Promise<{ reply: string; activity: ActivitySummary | null; recommendationId: string | null }> {
  const caregiverId = await getFamilySessionCaregiverId();
  if (!caregiverId) {
    throw new Error("Sessão expirada. Atualize a página.");
  }

  const supabase = createServiceClient();

  const lastUserMessage = [...input.history].reverse().find((turn) => turn.role === "user");
  if (!lastUserMessage) {
    throw new Error("Nenhuma mensagem para responder.");
  }

  // Defense in depth: childId only ever comes from this family's own
  // child list in the UI, but verify it actually belongs to the session's
  // family before trusting it — same check /test's action makes.
  let childId = input.childId;
  if (childId) {
    const [{ data: caregiver }, { data: child }] = await Promise.all([
      supabase.from("caregivers").select("family_id").eq("id", caregiverId).single(),
      supabase.from("children").select("id, family_id").eq("id", childId).maybeSingle(),
    ]);
    if (!child || child.family_id !== caregiver?.family_id) {
      childId = null;
    }
  }

  const { reply, activity, recommendationId } = await recordConversationTurn(supabase, {
    caregiverId,
    childId,
    messageBody: lastUserMessage.content,
    source: "quintal",
  });

  return { reply, activity, recommendationId };
}

// Thin wrapper around the Recommendation Engine's own feedback recorder
// (src/lib/recommendation.ts) — no session/caregiver check here on
// purpose, same reasoning as /atividades/[id]'s existing
// submitActivityFeedback: the recommendationId itself is an unguessable
// UUID the family only has because it was in their own conversation, and
// feedback isn't sensitive data worth gating behind the session.
export async function sendQuintalRecommendationFeedback(input: {
  recommendationId: string;
  feedback: RecommendationFeedback;
  note?: string;
}): Promise<void> {
  await submitRecommendationFeedback(input);
}
