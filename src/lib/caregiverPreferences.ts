import { createServiceClient } from "@/lib/supabase/service";
import type { MaterialCategory } from "@/lib/validation/library";

// ---------------------------------------------------------------------
// Fase 18 (Minha conta > Preferências/Notificações) — dados PESSOAIS do
// cuidador. Deliberadamente um módulo próprio, separado de
// familyContext.ts (preferências da FAMÍLIA) e de qualquer preferência
// futura por CRIANÇA — mesma separação de contexto pedida explicitamente
// nesta fase: USER PREFERENCE, FAMILY PREFERENCE e CHILD PREFERENCE
// nunca se misturam, nem no schema (tabelas diferentes: caregiver_
// preferences vs. family_preferences vs. children/uma futura tabela por
// criança) nem na leitura/escrita (nenhuma função deste arquivo aceita
// ou lê um family_id/child_id).
// ---------------------------------------------------------------------

export type CaregiverPreferences = {
  // Reaproveita o vocabulário já existente de categorias de Materiais
  // (Fase 12) em vez de inventar um novo — "que tipo de conteúdo você
  // quer ver mais" já tem uma lista pronta e usada em produção.
  contentInterests: MaterialCategory[];
  communicationStyle: string | null;
  notifyGeneral: boolean;
  notifyReminders: boolean;
  notifyRecommendations: boolean;
  notifyRoutineUpdates: boolean;
};

// Defaults de quem ainda não salvou nada — mesmos defaults da coluna no
// banco (notify_* = true), para a UI mostrar os toggles "ligados" antes
// da primeira visita já criar a linha.
const DEFAULT_PREFERENCES: CaregiverPreferences = {
  contentInterests: [],
  communicationStyle: null,
  notifyGeneral: true,
  notifyReminders: true,
  notifyRecommendations: true,
  notifyRoutineUpdates: true,
};

// null só significaria "erro ao buscar" — a ausência de uma linha já
// vira DEFAULT_PREFERENCES aqui (mesmo espírito de getChildFeedingMethod
// não distinguir "não configurado" de um objeto vazio): a família nunca
// vê um estado de erro só porque ainda não salvou nada.
export async function getCaregiverPreferences(caregiverId: string): Promise<CaregiverPreferences> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("caregiver_preferences")
    .select(
      "content_interests, communication_style, notify_general, notify_reminders, notify_recommendations, notify_routine_updates",
    )
    .eq("caregiver_id", caregiverId)
    .maybeSingle();

  if (!data) return DEFAULT_PREFERENCES;

  return {
    contentInterests: data.content_interests as MaterialCategory[],
    communicationStyle: data.communication_style,
    notifyGeneral: data.notify_general,
    notifyReminders: data.notify_reminders,
    notifyRecommendations: data.notify_recommendations,
    notifyRoutineUpdates: data.notify_routine_updates,
  };
}

// Upsert por design, mesmo padrão de updateFamilyPreferences
// (familyContext.ts): a maioria dos cuidadores não vai ter uma linha
// ainda (criada sob demanda, não no cadastro) — a aba "Preferências
// pessoais" precisa funcionar de primeira, sem um passo de "criar
// preferências" separado. Só mexe nos campos desta seção
// (content_interests/communication_style) — nunca sobrescreve os
// notify_* (ver updateCaregiverNotificationPreferences abaixo), pelo
// mesmo motivo de "salvar por seção, não um botão gigante" pedido nesta
// fase: cada form só manda os campos da própria aba.
export async function updateCaregiverPersonalPreferences(
  caregiverId: string,
  input: { contentInterests: MaterialCategory[]; communicationStyle: string | null },
): Promise<void> {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("caregiver_preferences")
    .select("notify_general, notify_reminders, notify_recommendations, notify_routine_updates")
    .eq("caregiver_id", caregiverId)
    .maybeSingle();

  const { error } = await supabase.from("caregiver_preferences").upsert({
    caregiver_id: caregiverId,
    content_interests: input.contentInterests,
    communication_style: input.communicationStyle,
    notify_general: existing?.notify_general ?? DEFAULT_PREFERENCES.notifyGeneral,
    notify_reminders: existing?.notify_reminders ?? DEFAULT_PREFERENCES.notifyReminders,
    notify_recommendations: existing?.notify_recommendations ?? DEFAULT_PREFERENCES.notifyRecommendations,
    notify_routine_updates: existing?.notify_routine_updates ?? DEFAULT_PREFERENCES.notifyRoutineUpdates,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }
}

// Mesmo raciocínio de updateCaregiverPersonalPreferences (upsert,
// preserva os campos da outra seção) — só na direção oposta: esta só
// mexe nos notify_*, nunca em content_interests/communication_style.
//
// IMPORTANTE: isto só grava a PREFERÊNCIA — não existe hoje nenhum job/
// e-mail/push que efetivamente notifique alguém (pedido explícito desta
// fase: "se a infraestrutura de notificações ainda não existir, criar
// apenas a configuração e persistência necessárias"). Quando essa
// infraestrutura existir, ela vai ler estes 4 campos antes de decidir
// se manda algo para este cuidador.
export async function updateCaregiverNotificationPreferences(
  caregiverId: string,
  input: {
    notifyGeneral: boolean;
    notifyReminders: boolean;
    notifyRecommendations: boolean;
    notifyRoutineUpdates: boolean;
  },
): Promise<void> {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("caregiver_preferences")
    .select("content_interests, communication_style")
    .eq("caregiver_id", caregiverId)
    .maybeSingle();

  const { error } = await supabase.from("caregiver_preferences").upsert({
    caregiver_id: caregiverId,
    content_interests: existing?.content_interests ?? DEFAULT_PREFERENCES.contentInterests,
    communication_style: existing?.communication_style ?? DEFAULT_PREFERENCES.communicationStyle,
    notify_general: input.notifyGeneral,
    notify_reminders: input.notifyReminders,
    notify_recommendations: input.notifyRecommendations,
    notify_routine_updates: input.notifyRoutineUpdates,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }
}
