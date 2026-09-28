"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { getFamilySessionCaregiverId } from "@/lib/familySession";
import { logActivityOutcome } from "@/lib/play";
import type { ActivityFeedback } from "@/lib/validation/play";

// Public by design — same tier as /atividades/[id] itself. Deliberately
// minimal: not tied to a specific family/child in this phase (the
// ActivityCard link carries no session/query params to attribute it), so
// child_id/caregiver_id stay null. Attributing feedback to a specific
// family is a natural next step once there's a reason to act on it
// per-family rather than just aggregate signal — see
// docs/PRODUCT_ROADMAP.md.
export async function submitActivityFeedback(activityId: string, helpful: boolean): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("activity_feedback").insert({
    activity_id: activityId,
    helpful,
  });

  if (error) {
    throw new Error(error.message);
  }
}

// "Fizeram essa atividade? Como foi?" (Fase 11) — diferente do thumbs
// acima: é pessoal (por criança), não anônimo, e por isso exige sessão
// de família. Nunca recebe um childId do cliente — resolve
// caregiver → family → primeira criança do zero aqui dentro, mesmo
// padrão de segurança de requireFamilyId em /quintal/*/actions.ts.
export async function logActivityOutcomeAction(activityId: string, feedback: ActivityFeedback): Promise<void> {
  const caregiverId = await getFamilySessionCaregiverId();
  if (!caregiverId) {
    throw new Error("Sessão não encontrada.");
  }

  const supabase = createServiceClient();
  const { data: caregiver } = await supabase
    .from("caregivers")
    .select("family_id")
    .eq("id", caregiverId)
    .maybeSingle();

  if (!caregiver) {
    throw new Error("Sessão não encontrada.");
  }

  const { data: childrenList } = await supabase
    .from("children")
    .select("id")
    .eq("family_id", caregiver.family_id)
    .order("created_at", { ascending: true })
    .limit(1);

  const primaryChild = childrenList?.[0];
  if (!primaryChild) {
    throw new Error("Nenhuma criança cadastrada.");
  }

  await logActivityOutcome({
    childId: primaryChild.id,
    activityId,
    feedback,
    origin: "manual",
  });
}
