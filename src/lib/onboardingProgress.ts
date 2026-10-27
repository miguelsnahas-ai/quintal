import { createServiceClient } from "@/lib/supabase/service";

// ---------------------------------------------------------------------
// Onboarding guiado (pedido explícito): tour de 1 vez só + checklist
// "Primeiros passos" na Home, por família. "Nunca inventa": só
// viewed_timeline_at (visita de página, não é um fato de dado) precisa
// de uma coluna própria — os outros três itens do checklist são
// DERIVADOS de dado real (events/messages/caregivers), nunca duplicados
// numa segunda tabela que poderia divergir do que de fato aconteceu.
// ---------------------------------------------------------------------

export type OnboardingChecklistKey = "registrar" | "chat" | "timeline" | "convidar";

export type OnboardingProgress = {
  tourCompleted: boolean;
  dismissed: boolean;
  items: Record<OnboardingChecklistKey, boolean>;
  allDone: boolean;
};

// Pura — testável sem banco, mesmo espírito de routineEngine.ts/
// caregiverSummary.ts (DECISÃO separada da busca do dado real abaixo).
export function buildOnboardingProgress(input: {
  tourCompletedAt: string | null;
  viewedTimelineAt: string | null;
  dismissedAt: string | null;
  hasEvent: boolean;
  hasChatMessage: boolean;
  hasMultipleCaregivers: boolean;
}): OnboardingProgress {
  const items: Record<OnboardingChecklistKey, boolean> = {
    registrar: input.hasEvent,
    chat: input.hasChatMessage,
    timeline: input.viewedTimelineAt !== null,
    convidar: input.hasMultipleCaregivers,
  };

  return {
    tourCompleted: input.tourCompletedAt !== null,
    dismissed: input.dismissedAt !== null,
    items,
    allDone: Object.values(items).every(Boolean),
  };
}

// Único ponto assíncrono do módulo — busca tudo em paralelo e delega a
// decisão pra buildOnboardingProgress acima.
export async function getOnboardingProgress(familyId: string): Promise<OnboardingProgress> {
  const supabase = createServiceClient();

  const [{ data: progressRow }, { data: childrenRows }, { data: messageRows }, { count: caregiverCount }] = await Promise.all([
    supabase
      .from("family_onboarding_progress")
      .select("tour_completed_at, viewed_timeline_at, checklist_dismissed_at")
      .eq("family_id", familyId)
      .maybeSingle(),
    supabase.from("children").select("id").eq("family_id", familyId),
    supabase.from("messages").select("id").eq("family_id", familyId).limit(1),
    supabase.from("caregivers").select("id", { count: "exact", head: true }).eq("family_id", familyId),
  ]);

  const childIds = (childrenRows ?? []).map((row) => row.id);
  let hasEvent = false;
  if (childIds.length > 0) {
    const { data: eventRows } = await supabase.from("events").select("id").in("child_id", childIds).limit(1);
    hasEvent = (eventRows ?? []).length > 0;
  }

  return buildOnboardingProgress({
    tourCompletedAt: progressRow?.tour_completed_at ?? null,
    viewedTimelineAt: progressRow?.viewed_timeline_at ?? null,
    dismissedAt: progressRow?.checklist_dismissed_at ?? null,
    hasEvent,
    hasChatMessage: (messageRows ?? []).length > 0,
    hasMultipleCaregivers: (caregiverCount ?? 0) > 1,
  });
}

export async function markTourCompleted(familyId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("family_onboarding_progress")
    .upsert(
      { family_id: familyId, tour_completed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: "family_id" },
    );
  if (error) throw new Error(error.message);
}

// Só escreve se ainda não tinha visto — evita um upsert a cada visita à
// Timeline depois que o item já está marcado.
export async function markTimelineViewed(familyId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("family_onboarding_progress")
    .select("viewed_timeline_at")
    .eq("family_id", familyId)
    .maybeSingle();
  if (data?.viewed_timeline_at) return;

  const { error } = await supabase
    .from("family_onboarding_progress")
    .upsert(
      { family_id: familyId, viewed_timeline_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: "family_id" },
    );
  if (error) throw new Error(error.message);
}

export async function dismissOnboardingChecklist(familyId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("family_onboarding_progress")
    .upsert(
      { family_id: familyId, checklist_dismissed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: "family_id" },
    );
  if (error) throw new Error(error.message);
}
