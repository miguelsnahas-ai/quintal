import { createServiceClient } from "@/lib/supabase/service";
import { ageLabel } from "@/lib/format";
import type { FamilyPreferences } from "@/lib/childContext";
import type { PreferenceCategory } from "@/lib/validation/chatAction";
import type { AccessRole } from "@/lib/authorization";
import { canRemoveCaregiverRole } from "@/lib/authorization";
import type { MaterialCategory } from "@/lib/validation/library";
import {
  type RecommendationStyle,
  type RoutineFlexibility,
  type RoutineActivityFocus,
  type ChildRoutinePreference,
  childRoutinePreferenceLabels,
} from "@/lib/validation/profile";

// The read+write counterpart to childContext.ts's getChildContext: that
// one is READ-ONLY and shaped for the AI prompt (per child, with recent
// events folded in). This one is for /quintal/perfil — the whole
// family's editable profile (family, caregivers, every child, family
// preferences) — a different concern (editing, not prompting), so it
// gets its own module rather than growing ChildContext into two jobs.
export type FamilyProfileChild = {
  id: string;
  name: string;
  birthDate: string | null;
  ageLabel: string | null;
  sex: string | null;
  notes: string | null;
  interests: string[];
  avatarUrl: string | null;
  // Linha única (Fase 20) para a lista de crianças — construída a partir
  // de dados já estruturados (interesses, brincadeiras favoritas, rotina),
  // nunca uma nova consulta pesada por criança. null quando a criança
  // ainda não tem nenhuma preferência configurada.
  contextSummary: string | null;
};

export type FamilyProfileCaregiver = {
  id: string;
  name: string;
  phoneNumber: string;
  role: string | null;
  isPrimaryContact: boolean;
  // Papel de ACESSO (Fase 16) — não confundir com `role` acima
  // (parentesco livre, ex. "mãe"/"avó"): ver src/lib/authorization.ts.
  accessRole: AccessRole;
};

export type FamilyProfile = {
  family: { id: string; name: string; notes: string | null; avatarUrl: string | null };
  caregivers: FamilyProfileCaregiver[];
  children: FamilyProfileChild[];
  // null when the family hasn't saved any preference yet — family_preferences
  // rows are created lazily on first save, not at signup.
  preferences: FamilyPreferences | null;
};

export async function getFamilyProfile(familyId: string): Promise<FamilyProfile | null> {
  const supabase = createServiceClient();

  const [{ data: family }, { data: caregivers }, { data: children }, { data: preferencesRaw }] =
    await Promise.all([
      supabase.from("families").select("id, name, notes, avatar_url").eq("id", familyId).maybeSingle(),
      supabase
        .from("caregivers")
        .select("id, name, phone_number, role, is_primary_contact, access_role")
        .eq("family_id", familyId)
        .order("created_at", { ascending: true }),
      supabase
        .from("children")
        .select("id, name, birth_date, sex, notes, interests, avatar_url")
        .eq("family_id", familyId)
        .order("created_at", { ascending: true }),
      supabase
        .from("family_preferences")
        .select(
          "feeding_notes, routine_notes, play_notes, materials_notes, interaction_style, recommendation_style, routine_flexibility, routine_activity_focus, content_focus",
        )
        .eq("family_id", familyId)
        .maybeSingle(),
    ]);

  if (!family) return null;

  // Segunda consulta, batelada por família (não uma por criança): resumo
  // contextual da lista de crianças (Fase 20) reaproveita child_preferences
  // já existente em vez de repetir a leitura pesada de getChildContext
  // (histórico de eventos) só para montar uma linha de card.
  const childIds = (children ?? []).map((child) => child.id);
  const { data: childPreferencesRaw } =
    childIds.length > 0
      ? await supabase
          .from("child_preferences")
          .select("child_id, favorite_activities, routine_preference")
          .in("child_id", childIds)
      : { data: [] as { child_id: string; favorite_activities: string[]; routine_preference: string | null }[] };

  const preferencesByChildId = new Map(
    (childPreferencesRaw ?? []).map((row) => [row.child_id, row]),
  );

  return {
    family: { id: family.id, name: family.name, notes: family.notes, avatarUrl: family.avatar_url },
    caregivers: (caregivers ?? []).map((caregiver) => ({
      id: caregiver.id,
      name: caregiver.name,
      phoneNumber: caregiver.phone_number,
      role: caregiver.role,
      isPrimaryContact: caregiver.is_primary_contact,
      accessRole: caregiver.access_role as AccessRole,
    })),
    children: (children ?? []).map((child) => ({
      id: child.id,
      name: child.name,
      birthDate: child.birth_date,
      ageLabel: ageLabel(child.birth_date),
      sex: child.sex,
      notes: child.notes,
      interests: child.interests,
      avatarUrl: child.avatar_url,
      contextSummary: summarizeChildContext(child.interests, preferencesByChildId.get(child.id)),
    })),
    preferences: preferencesRaw
      ? {
          feedingNotes: preferencesRaw.feeding_notes,
          routineNotes: preferencesRaw.routine_notes,
          playNotes: preferencesRaw.play_notes,
          materialsNotes: preferencesRaw.materials_notes,
          interactionStyle: preferencesRaw.interaction_style,
          recommendationStyle: preferencesRaw.recommendation_style as RecommendationStyle | null,
          routineFlexibility: preferencesRaw.routine_flexibility as RoutineFlexibility | null,
          routineActivityFocus: preferencesRaw.routine_activity_focus as RoutineActivityFocus | null,
          contentFocus: preferencesRaw.content_focus as MaterialCategory[],
        }
      : null,
  };
}

function summarizeChildContext(
  interests: string[],
  preferences: { favorite_activities: string[]; routine_preference: string | null } | undefined,
): string | null {
  const parts: string[] = [];
  if (interests.length > 0) parts.push(`Interesses: ${interests.slice(0, 3).join(", ")}`);
  if (preferences && preferences.favorite_activities.length > 0) {
    parts.push(`Brincadeiras favoritas: ${preferences.favorite_activities.slice(0, 2).join(", ")}`);
  }
  if (preferences?.routine_preference) {
    parts.push(`Rotina: ${childRoutinePreferenceLabels[preferences.routine_preference as ChildRoutinePreference]}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

// Informações básicas de UMA criança (Fase 16/20): nome, nascimento,
// avatar, sexo. Interesses NÃO entram aqui (ver childPreferences.ts,
// onde moram junto de brincadeiras favoritas/materiais desde a Fase 20).
export async function updateChildProfile(
  childId: string,
  input: { name: string; birthDate: string | null; avatarUrl: string | null; sex: string | null },
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("children")
    .update({
      name: input.name,
      birth_date: input.birthDate,
      avatar_url: input.avatarUrl,
      sex: input.sex,
    })
    .eq("id", childId);

  if (error) {
    throw new Error(error.message);
  }
}

// Essential fields only, on purpose — nome/nascimento/interesses (usado
// hoje só pelo helper de chat addChildInterest abaixo; o formulário de
// Configurações usa updateChildProfile + childPreferences.ts em vez
// disso, ver Fase 20).
export async function updateChildEssentials(
  childId: string,
  input: { name: string; birthDate: string | null; interests: string[] },
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("children")
    .update({
      name: input.name,
      birth_date: input.birthDate,
      interests: input.interests,
    })
    .eq("id", childId);

  if (error) {
    throw new Error(error.message);
  }
}

// "Adicionar criança" (Fase 16) — fluxo simples pedido: nome, data de
// nascimento, sem foto/avatar (a arquitetura de imagem que existe hoje
// no produto é só pra conteúdo da biblioteca, não pra fotos de família;
// adicionar upload de foto de criança é um passo maior, deixado para
// quando houver evidência de necessidade). Vincula (caregiver_child) a
// TODO cuidador já existente da família automaticamente — o owner
// sempre tem acesso à criança que acabou de cadastrar, e qualquer outro
// "Perfil da família" (Fase 17/19, /quintal/configuracoes/familia) — nome
// e avatar. Antes da Fase 17, o nome da família só era editável via /ops
// (updateFamily, operador); agora a própria família consegue, na área de
// Configurações — mesmas colunas, só um segundo caminho de escrita
// family-facing. Restrito ao owner (ver canManageFamily) — diferente de
// updateFamilyPreferences abaixo, que qualquer cuidador pode ajustar.
export async function updateFamilyProfile(
  familyId: string,
  input: { name: string; avatarUrl: string | null },
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("families")
    .update({ name: input.name, avatar_url: input.avatarUrl })
    .eq("id", familyId);

  if (error) {
    throw new Error(error.message);
  }
}

// "Minha conta > Perfil" (Fase 17/18, /quintal/configuracoes/conta) — um
// cuidador editando o próprio nome e avatar. Escopado por caregiverId
// apenas (não por família): quem chama isto já resolveu a sessão e só tem
// o próprio caregiverId em mãos, nunca o de outra pessoa. avatarUrl é
// nullable (sem infraestrutura de upload — ver a migration da Fase 18):
// null limpa o avatar e volta pro fallback de iniciais na UI.
export async function updateCaregiverProfile(
  caregiverId: string,
  input: { name: string; avatarUrl: string | null },
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("caregivers")
    .update({ name: input.name, avatar_url: input.avatarUrl })
    .eq("id", caregiverId);

  if (error) {
    throw new Error(error.message);
  }
}

// cuidador da família também, mesmo comportamento implícito que já
// existia antes desta fase para toda criança/cuidador de uma família.
export async function createChild(
  familyId: string,
  input: { name: string; birthDate: string | null },
): Promise<{ id: string }> {
  const supabase = createServiceClient();

  const { data: child, error } = await supabase
    .from("children")
    .insert({ family_id: familyId, name: input.name, birth_date: input.birthDate })
    .select("id")
    .single();

  if (error || !child) {
    throw new Error(error?.message ?? "Não foi possível cadastrar a criança.");
  }

  const { data: caregivers } = await supabase.from("caregivers").select("id").eq("family_id", familyId);
  if (caregivers && caregivers.length > 0) {
    const { error: linkError } = await supabase
      .from("caregiver_child")
      .insert(caregivers.map((caregiver) => ({ caregiver_id: caregiver.id, child_id: child.id })));
    if (linkError) {
      console.error("Failed to link existing caregivers to new child", linkError);
    }
  }

  return { id: child.id };
}

// "Remover criança" (Fase 16) — irreversível: apaga também todo o
// histórico da criança (events tem on delete cascade em child_id, mesmo
// comportamento que /ops/families/[id] já usa para isto). Escopado por
// familyId (não só childId) pela mesma razão de toda outra função deste
// arquivo: nunca confiar só no id vindo do formulário.
export async function deleteChild(childId: string, familyId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("children").delete().eq("id", childId).eq("family_id", familyId);

  if (error) {
    throw new Error(error.message);
  }
}

// "Remover cuidador" (revisão da área de Configurações) — Cuidadores
// tinha "Convidar" mas nunca "Remover", diferente de Crianças (que já
// tem os dois desde a Fase 16) — a mesma assimetria que esta revisão
// corrige. Nunca remove um owner por aqui: a única forma de uma família
// ficar sem administrador seria essa, e trocar quem administra é uma
// decisão maior, fora do escopo desta ação. Cascata (caregiver_child,
// caregiver_sessions, caregiver_preferences — todas com on delete
// cascade) tira o acesso e encerra a sessão do cuidador removido
// imediatamente.
export async function removeCaregiver(caregiverId: string, familyId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: target } = await supabase
    .from("caregivers")
    .select("access_role")
    .eq("id", caregiverId)
    .eq("family_id", familyId)
    .maybeSingle();

  if (!target) {
    throw new Error("Cuidador não encontrado.");
  }
  if (!canRemoveCaregiverRole(target.access_role as AccessRole)) {
    throw new Error("Não é possível remover quem administra a família.");
  }

  const { error } = await supabase.from("caregivers").delete().eq("id", caregiverId).eq("family_id", familyId);

  if (error) {
    throw new Error(error.message);
  }
}

// child_interest é a única categoria de preferência que não mora em
// family_preferences (mora em children.interests) — mapeia direto pra
// updateChildEssentials, sem duplicar a lógica de leitura aqui.
export async function addChildInterest(childId: string, interest: string): Promise<void> {
  const trimmed = interest.trim();
  if (!trimmed) return;

  const supabase = createServiceClient();
  const { data: child } = await supabase
    .from("children")
    .select("name, birth_date, interests")
    .eq("id", childId)
    .maybeSingle();

  if (!child) {
    throw new Error("Criança não encontrada.");
  }

  // Dedupe (case-insensitive) — uma preferência já registrada não deveria
  // virar uma entrada repetida só porque o chat mencionou de novo.
  const alreadyHas = child.interests.some(
    (existing) => existing.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  if (alreadyHas) return;

  await updateChildEssentials(childId, {
    name: child.name,
    birthDate: child.birth_date,
    interests: [...child.interests, trimmed],
  });
}

const PREFERENCE_FIELD_BY_CATEGORY: Record<
  Exclude<PreferenceCategory, "child_interest">,
  "feeding_notes" | "routine_notes" | "play_notes" | "materials_notes" | "interaction_style"
> = {
  feeding: "feeding_notes",
  routine: "routine_notes",
  play: "play_notes",
  materials: "materials_notes",
  interaction: "interaction_style",
};

// Read-modify-write, deliberadamente ADITIVO — diferente de
// updateFamilyPreferences acima (que SUBSTITUI o campo inteiro e existe
// para o formulário de /quintal/perfil, onde a família vê e edita o
// texto completo). Uma preferência mencionada de passagem no chat
// ("ela não gosta muito de barulho") deveria se SOMAR ao que a família já
// escreveu em /quintal/perfil, nunca apagar silenciosamente o que já
// estava lá — daí este ser um caminho de escrita separado, não uma
// variante da função acima. Usado por src/lib/chatActions.ts (Fase 15).
export async function appendFamilyPreferenceNote(
  familyId: string,
  category: Exclude<PreferenceCategory, "child_interest">,
  note: string,
): Promise<void> {
  const trimmed = note.trim();
  if (!trimmed) return;

  const field = PREFERENCE_FIELD_BY_CATEGORY[category];
  const supabase = createServiceClient();

  // Seleciona as 5 colunas (não só `field`) para manter um shape estável
  // e indexável por chave dinâmica — supabase-js tipa `.select(field)`
  // como uma união de objetos de uma chave só, que o TypeScript não deixa
  // indexar por uma variável.
  const { data: existing } = await supabase
    .from("family_preferences")
    .select("feeding_notes, routine_notes, play_notes, materials_notes, interaction_style")
    .eq("family_id", familyId)
    .maybeSingle();

  const current = existing ? (existing as Record<string, string | null>)[field] : null;
  const combined = current ? `${current}\n${trimmed}` : trimmed;

  // Upsert só com a coluna alvo (mais updated_at) — escrito como switch em
  // vez de uma chave computada `{ [field]: combined }` porque o tipo de
  // Insert do supabase-js rejeita um objeto com chave dinâmica (só aceita
  // literais conhecidos em tempo de compilação).
  const patch = { family_id: familyId, updated_at: new Date().toISOString() };
  const { error } = await supabase.from("family_preferences").upsert(
    field === "feeding_notes"
      ? { ...patch, feeding_notes: combined }
      : field === "routine_notes"
        ? { ...patch, routine_notes: combined }
        : field === "play_notes"
          ? { ...patch, play_notes: combined }
          : field === "materials_notes"
            ? { ...patch, materials_notes: combined }
            : { ...patch, interaction_style: combined },
  );

  if (error) {
    throw new Error(error.message);
  }
}

// Upsert by design: most families won't have a family_preferences row
// yet (it's created lazily, not at /comecar signup) — the "advanced"
// section of /quintal/perfil should just work the first time someone
// opens it, without a separate "create preferences" step.
export async function updateFamilyPreferences(
  familyId: string,
  input: {
    recommendationStyle: RecommendationStyle | null;
    routineFlexibility: RoutineFlexibility | null;
    routineActivityFocus: RoutineActivityFocus | null;
    contentFocus: MaterialCategory[];
    feedingNotes: string | null;
    routineNotes: string | null;
    playNotes: string | null;
    materialsNotes: string | null;
    interactionStyle: string | null;
  },
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("family_preferences").upsert({
    family_id: familyId,
    recommendation_style: input.recommendationStyle,
    routine_flexibility: input.routineFlexibility,
    routine_activity_focus: input.routineActivityFocus,
    content_focus: input.contentFocus,
    feeding_notes: input.feedingNotes,
    routine_notes: input.routineNotes,
    play_notes: input.playNotes,
    materials_notes: input.materialsNotes,
    interaction_style: input.interactionStyle,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }
}
