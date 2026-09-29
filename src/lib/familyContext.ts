import { createServiceClient } from "@/lib/supabase/service";
import { ageLabel } from "@/lib/format";
import type { FamilyPreferences } from "@/lib/childContext";
import type { PreferenceCategory } from "@/lib/validation/chatAction";

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
};

export type FamilyProfileCaregiver = {
  id: string;
  name: string;
  phoneNumber: string;
  role: string | null;
  isPrimaryContact: boolean;
};

export type FamilyProfile = {
  family: { id: string; name: string; notes: string | null };
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
      supabase.from("families").select("id, name, notes").eq("id", familyId).maybeSingle(),
      supabase
        .from("caregivers")
        .select("id, name, phone_number, role, is_primary_contact")
        .eq("family_id", familyId)
        .order("created_at", { ascending: true }),
      supabase
        .from("children")
        .select("id, name, birth_date, sex, notes, interests")
        .eq("family_id", familyId)
        .order("created_at", { ascending: true }),
      supabase
        .from("family_preferences")
        .select("feeding_notes, routine_notes, play_notes, materials_notes, interaction_style")
        .eq("family_id", familyId)
        .maybeSingle(),
    ]);

  if (!family) return null;

  return {
    family,
    caregivers: (caregivers ?? []).map((caregiver) => ({
      id: caregiver.id,
      name: caregiver.name,
      phoneNumber: caregiver.phone_number,
      role: caregiver.role,
      isPrimaryContact: caregiver.is_primary_contact,
    })),
    children: (children ?? []).map((child) => ({
      id: child.id,
      name: child.name,
      birthDate: child.birth_date,
      ageLabel: ageLabel(child.birth_date),
      sex: child.sex,
      notes: child.notes,
      interests: child.interests,
    })),
    preferences: preferencesRaw
      ? {
          feedingNotes: preferencesRaw.feeding_notes,
          routineNotes: preferencesRaw.routine_notes,
          playNotes: preferencesRaw.play_notes,
          materialsNotes: preferencesRaw.materials_notes,
          interactionStyle: preferencesRaw.interaction_style,
        }
      : null,
  };
}

// Essential fields only, on purpose (progressive disclosure lives in the
// UI, not here): name, birth date, interests. Notes/sex stay
// operator-editable via /ops/children/[id] for now — this is the
// family's own light-touch edit, not a full profile system.
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
