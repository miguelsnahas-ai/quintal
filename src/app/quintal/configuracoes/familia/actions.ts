"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionCaregiver, canManageFamily } from "@/lib/authorization";
import { updateFamilyName, updateFamilyPreferences } from "@/lib/familyContext";
import { updateFamilyNameInputSchema, familyPreferencesInputSchema } from "@/lib/validation/profile";

// "Perfil da família" (Fase 17) — restrito ao owner: o nome da família é
// um dado compartilhado por todo mundo, diferente de uma preferência
// (que qualquer cuidador pode ajustar, ver saveFamilyPreferencesAction
// abaixo). Mesmo nível de permissão que renomear a família já tem em
// /ops (updateFamily, lá restrito a operador).
export async function updateFamilyNameAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const allowed = await canManageFamily(session.caregiverId, session.familyId);
  if (!allowed) {
    redirect(
      `/quintal/configuracoes/familia?aba=perfil&error=${encodeURIComponent("Só quem administra a família pode renomeá-la.")}`,
    );
  }

  const parsed = updateFamilyNameInputSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    redirect(`/quintal/configuracoes/familia?aba=perfil&error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  try {
    await updateFamilyName(session.familyId, parsed.data.name);
  } catch {
    redirect(
      `/quintal/configuracoes/familia?aba=perfil&error=${encodeURIComponent("Não foi possível salvar. Tente de novo.")}`,
    );
  }

  revalidatePath("/quintal/configuracoes/familia");
  revalidatePath("/quintal/configuracoes");
  redirect("/quintal/configuracoes/familia?aba=perfil&success=1");
}

// Movida de /quintal/perfil/actions.ts (Fase 17) — mesma função, mesma
// regra (qualquer cuidador da família pode ajustar preferências, não só
// o owner), só de casa nova.
export async function saveFamilyPreferencesAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const parsed = familyPreferencesInputSchema.safeParse({
    family_id: session.familyId,
    feeding_notes: formData.get("feeding_notes"),
    routine_notes: formData.get("routine_notes"),
    play_notes: formData.get("play_notes"),
    materials_notes: formData.get("materials_notes"),
    interaction_style: formData.get("interaction_style"),
  });

  if (!parsed.success) {
    redirect(
      `/quintal/configuracoes/familia?aba=preferencias&error=${encodeURIComponent(parsed.error.issues[0].message)}`,
    );
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
    redirect(
      `/quintal/configuracoes/familia?aba=preferencias&error=${encodeURIComponent("Não foi possível salvar. Tente de novo.")}`,
    );
  }

  revalidatePath("/quintal/configuracoes/familia");
  redirect("/quintal/configuracoes/familia?aba=preferencias&success=1");
}
