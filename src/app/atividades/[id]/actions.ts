"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { getSessionCaregiver } from "@/lib/authorization";
import { getActiveChildContext } from "@/lib/activeChild";
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
// de família. Nunca recebe um childId do cliente — resolve a criança
// ATIVA (Fase 16, ver src/lib/activeChild.ts) a partir da sessão, não
// mais "a primeira criança da família": abrir uma atividade recomendada
// enquanto o Pedro está selecionado registra o resultado no Pedro, não
// sempre no primeiro filho cadastrado.
export async function logActivityOutcomeAction(activityId: string, feedback: ActivityFeedback): Promise<void> {
  const session = await getSessionCaregiver();
  if (!session) {
    throw new Error("Sessão não encontrada.");
  }

  const { active: activeChild } = await getActiveChildContext(session.caregiverId);
  if (!activeChild) {
    throw new Error("Nenhuma criança cadastrada.");
  }

  await logActivityOutcome({
    childId: activeChild.id,
    activityId,
    feedback,
    origin: "manual",
    caregiverId: session.caregiverId,
  });
}
