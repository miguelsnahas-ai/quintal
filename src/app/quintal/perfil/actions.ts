"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionCaregiver, canAccessChild, type SessionCaregiver } from "@/lib/authorization";
import { updateChildEssentials, updateFamilyPreferences } from "@/lib/familyContext";
import { childEssentialsInputSchema, familyPreferencesInputSchema } from "@/lib/validation/profile";

// Camada de autorização centralizada (Fase 16) — ver src/lib/authorization.ts.
async function requireSession(): Promise<SessionCaregiver> {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }
  return session;
}

export async function saveChildEssentials(formData: FormData) {
  const session = await requireSession();

  const parsed = childEssentialsInputSchema.safeParse({
    child_id: formData.get("child_id"),
    name: formData.get("name"),
    birth_date: formData.get("birth_date"),
    interests: formData.get("interests"),
  });

  if (!parsed.success) {
    redirect(`/quintal/perfil?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  // Defense in depth: the childId in the form only ever comes from this
  // family's own profile page, but verify the caregiver actually has
  // access to it before writing — same check every other /quintal action
  // makes (Fase 16: via caregiver_child, not just family_id).
  const allowed = await canAccessChild(session.caregiverId, parsed.data.child_id);
  if (!allowed) {
    redirect(`/quintal/perfil?error=${encodeURIComponent("Criança inválida.")}`);
  }

  try {
    await updateChildEssentials(parsed.data.child_id, {
      name: parsed.data.name,
      birthDate: parsed.data.birth_date,
      interests: parsed.data.interests,
    });
  } catch {
    redirect(`/quintal/perfil?error=${encodeURIComponent("Não foi possível salvar. Tente de novo.")}`);
  }

  // Dashboard shows child name/age too — keep it in sync immediately.
  revalidatePath("/quintal/perfil");
  revalidatePath("/quintal");
  redirect("/quintal/perfil?success=1");
}

export async function saveFamilyPreferences(formData: FormData) {
  const session = await requireSession();

  const parsed = familyPreferencesInputSchema.safeParse({
    family_id: session.familyId,
    feeding_notes: formData.get("feeding_notes"),
    routine_notes: formData.get("routine_notes"),
    play_notes: formData.get("play_notes"),
    materials_notes: formData.get("materials_notes"),
    interaction_style: formData.get("interaction_style"),
  });

  if (!parsed.success) {
    redirect(`/quintal/perfil?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  try {
    await updateFamilyPreferences(session.familyId, {
      feedingNotes: parsed.data.feeding_notes,
      routineNotes: parsed.data.routine_notes,
      playNotes: parsed.data.play_notes,
      materialsNotes: parsed.data.materials_notes,
      interactionStyle: parsed.data.interaction_style,
    });
  } catch {
    redirect(`/quintal/perfil?error=${encodeURIComponent("Não foi possível salvar. Tente de novo.")}`);
  }

  revalidatePath("/quintal/perfil");
  redirect("/quintal/perfil?success=1");
}
