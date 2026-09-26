"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getFamilySessionCaregiverId } from "@/lib/familySession";
import { createServiceClient } from "@/lib/supabase/service";
import { updateChildEssentials, updateFamilyPreferences } from "@/lib/familyContext";
import { childEssentialsInputSchema, familyPreferencesInputSchema } from "@/lib/validation/profile";

// Same session-resolution pattern as every other /quintal action: never
// trust a client-supplied family_id, always resolve it server-side from
// the httpOnly session cookie.
async function requireFamilyId(): Promise<string> {
  const caregiverId = await getFamilySessionCaregiverId();
  if (!caregiverId) {
    redirect("/comecar");
  }

  const supabase = createServiceClient();
  const { data: caregiver } = await supabase
    .from("caregivers")
    .select("family_id")
    .eq("id", caregiverId)
    .maybeSingle();

  if (!caregiver) {
    redirect("/comecar");
  }

  return caregiver.family_id;
}

export async function saveChildEssentials(formData: FormData) {
  const familyId = await requireFamilyId();

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
  // family's own profile page, but verify it actually belongs to the
  // session's family before writing — same check the chat's send actions
  // already make for childId.
  const supabase = createServiceClient();
  const { data: child } = await supabase
    .from("children")
    .select("family_id")
    .eq("id", parsed.data.child_id)
    .maybeSingle();

  if (!child || child.family_id !== familyId) {
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
  const familyId = await requireFamilyId();

  const parsed = familyPreferencesInputSchema.safeParse({
    family_id: familyId,
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
    await updateFamilyPreferences(familyId, {
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
