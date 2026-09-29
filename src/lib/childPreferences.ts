import { createServiceClient } from "@/lib/supabase/service";
import type { ChildRoutinePreference, ChildActivityStyle } from "@/lib/validation/profile";

// ---------------------------------------------------------------------
// Fase 20 (Configurações > Crianças > Preferências) — preferências e
// contexto de UMA criança. Módulo próprio, deliberadamente separado de
// caregiverPreferences.ts (pessoal do CUIDADOR) e de familyContext.ts's
// family_preferences (compartilhada pela FAMÍLIA) — mesma separação de
// contexto USER/FAMILY/CHILD estabelecida na Fase 18, agora completa nos
// três níveis. Toda função aqui é escopada por child_id apenas; nenhuma
// aceita family_id/caregiver_id, e cada criança tem sua própria linha —
// nunca há mistura entre irmãos.
//
// Não inclui interesses (children.interests, Fase 8) nem "sobre esta
// criança" (children.notes, Fase 8/20) — editados junto nesta mesma tela,
// mas persistidos em children, não aqui (ver updateChildPreferences).
// Revisão da área de Configurações (pós-Fase 20): child_preferences
// chegou a ter um segundo campo de texto livre, caregiver_notes
// ("Observações dos cuidadores"), sobrepondo children.notes ("Sobre esta
// criança") sem diferença de propósito clara — removido do schema para
// não haver duas caixas de observação livre por criança. Não inclui
// método alimentar (children.feeding_method_id/custom — pedido explícito
// da Fase 20 para não duplicar o módulo de Alimentação, ver
// src/lib/feeding.ts).
// ---------------------------------------------------------------------

export type ChildPreferences = {
  favoriteActivities: string[];
  preferredMaterials: string[];
  routinePreference: ChildRoutinePreference | null;
  activityStyle: ChildActivityStyle | null;
  routineNotes: string | null;
  feedingNotes: string | null;
};

const DEFAULT_PREFERENCES: ChildPreferences = {
  favoriteActivities: [],
  preferredMaterials: [],
  routinePreference: null,
  activityStyle: null,
  routineNotes: null,
  feedingNotes: null,
};

// Ausência de linha (criança ainda sem preferências salvas) vira
// DEFAULT_PREFERENCES aqui, mesmo espírito de getCaregiverPreferences —
// a família nunca vê um estado de erro só porque ainda não configurou
// nada.
export async function getChildPreferences(childId: string): Promise<ChildPreferences> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("child_preferences")
    .select("favorite_activities, preferred_materials, routine_preference, activity_style, routine_notes, feeding_notes")
    .eq("child_id", childId)
    .maybeSingle();

  if (!data) return DEFAULT_PREFERENCES;

  return {
    favoriteActivities: data.favorite_activities,
    preferredMaterials: data.preferred_materials,
    routinePreference: data.routine_preference as ChildRoutinePreference | null,
    activityStyle: data.activity_style as ChildActivityStyle | null,
    routineNotes: data.routine_notes,
    feedingNotes: data.feeding_notes,
  };
}

// Um único formulário/ação salva tudo aqui (diferente de "Minha conta",
// Fase 18, que separa perfil/preferências/notificações em ações
// distintas): interesses, "sobre esta criança", brincadeiras favoritas,
// materiais, rotina e alimentação são todos a mesma aba "Preferências"
// desta criança, então um save por seção não traria benefício de UX
// aqui. interests/notes moram em children (Fase 8), o resto em
// child_preferences — as duas escritas ficam nesta única função para o
// chamador não precisar saber que são tabelas diferentes.
export async function updateChildPreferences(
  childId: string,
  input: ChildPreferences & { interests: string[]; notes: string | null },
): Promise<void> {
  const supabase = createServiceClient();

  const { error: childError } = await supabase
    .from("children")
    .update({ interests: input.interests, notes: input.notes })
    .eq("id", childId);
  if (childError) {
    throw new Error(childError.message);
  }

  const { error } = await supabase.from("child_preferences").upsert({
    child_id: childId,
    favorite_activities: input.favoriteActivities,
    preferred_materials: input.preferredMaterials,
    routine_preference: input.routinePreference,
    activity_style: input.activityStyle,
    routine_notes: input.routineNotes,
    feeding_notes: input.feedingNotes,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }
}
