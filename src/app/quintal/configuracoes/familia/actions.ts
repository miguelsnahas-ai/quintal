"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionCaregiver, canManageFamily } from "@/lib/authorization";
import { updateFamilyProfile, updateFamilyPreferences } from "@/lib/familyContext";
import { updateFamilyProfileInputSchema, familyPreferencesInputSchema } from "@/lib/validation/profile";

// "Perfil da família" (Fase 17/19) — restrito ao owner: nome e avatar da
// família são dados compartilhados por todo mundo, diferente de uma
// preferência. Mesmo nível de permissão que renomear a família já tem em
// /ops (updateFamily, lá restrito a operador).
export async function updateFamilyProfileAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const allowed = await canManageFamily(session.caregiverId, session.familyId);
  if (!allowed) {
    redirect(
      `/quintal/configuracoes/familia?aba=perfil&error=${encodeURIComponent("Só quem administra a família pode editar o perfil.")}`,
    );
  }

  const parsed = updateFamilyProfileInputSchema.safeParse({
    name: formData.get("name"),
    avatar_url: formData.get("avatar_url"),
  });
  if (!parsed.success) {
    redirect(`/quintal/configuracoes/familia?aba=perfil&error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  try {
    await updateFamilyProfile(session.familyId, { name: parsed.data.name, avatarUrl: parsed.data.avatar_url });
  } catch {
    redirect(
      `/quintal/configuracoes/familia?aba=perfil&error=${encodeURIComponent("Não foi possível salvar. Tente de novo.")}`,
    );
  }

  revalidatePath("/quintal/configuracoes/familia");
  revalidatePath("/quintal/configuracoes");
  redirect("/quintal/configuracoes/familia?aba=perfil&success=1");
}

// "Preferências da família" (Fase 19) — mesma restrição ao owner que o
// perfil (mudança desta fase: até a Fase 17, qualquer cuidador podia
// ajustar; o pedido agora é explícito — "OWNER pode editar, CAREGIVER
// pode visualizar"). São compartilhadas com toda a família (ver o aviso
// na UI), então só quem administra a família as edita.
export async function saveFamilyPreferencesAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const allowed = await canManageFamily(session.caregiverId, session.familyId);
  if (!allowed) {
    redirect(
      `/quintal/configuracoes/familia?aba=preferencias&error=${encodeURIComponent("Só quem administra a família pode editar as preferências.")}`,
    );
  }

  const parsed = familyPreferencesInputSchema.safeParse({
    family_id: session.familyId,
    recommendation_style: formData.get("recommendation_style"),
    routine_flexibility: formData.get("routine_flexibility"),
    routine_activity_focus: formData.get("routine_activity_focus"),
    content_focus: formData.getAll("content_focus"),
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
      recommendationStyle: parsed.data.recommendation_style,
      routineFlexibility: parsed.data.routine_flexibility,
      routineActivityFocus: parsed.data.routine_activity_focus,
      contentFocus: parsed.data.content_focus,
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
