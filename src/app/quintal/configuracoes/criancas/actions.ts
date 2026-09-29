"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionCaregiver, canEditChild, canManageFamily } from "@/lib/authorization";
import { createChild, deleteChild, updateChildProfile, updateChildContextNotes } from "@/lib/familyContext";
import { updateChildPreferences } from "@/lib/childPreferences";
import { updateChildFeedingMethod } from "@/lib/feeding";
import {
  addChildInputSchema,
  updateChildProfileInputSchema,
  childPreferencesInputSchema,
  updateChildContextNotesInputSchema,
} from "@/lib/validation/profile";
import { feedingMethodInputSchema } from "@/lib/validation/feeding";

// Movida de /quintal/familia/actions.ts (Fase 17) — mesma função, mesma
// regra (qualquer cuidador pode adicionar, não só o owner).
export async function addChildAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const parsed = addChildInputSchema.safeParse({
    name: formData.get("name"),
    birth_date: formData.get("birth_date"),
  });

  if (!parsed.success) {
    redirect(`/quintal/configuracoes/criancas?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  try {
    await createChild(session.familyId, { name: parsed.data.name, birthDate: parsed.data.birth_date });
  } catch {
    redirect(`/quintal/configuracoes/criancas?error=${encodeURIComponent("Não foi possível cadastrar. Tente de novo.")}`);
  }

  revalidatePath("/quintal/configuracoes/criancas");
  revalidatePath("/quintal/configuracoes");
  revalidatePath("/quintal");
  redirect("/quintal/configuracoes/criancas?success=1");
}

// Movida de /quintal/familia/actions.ts (Fase 17) — mesma função, mesma
// regra (irreversível, restrita ao owner — "acesso administrativo" do
// owner, Fase 20).
export async function removeChildAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const childId = String(formData.get("child_id") ?? "");

  const [hasAccess, isOwner] = await Promise.all([
    canEditChild(session.caregiverId, childId),
    canManageFamily(session.caregiverId, session.familyId),
  ]);

  if (!hasAccess || !isOwner) {
    redirect(
      `/quintal/configuracoes/criancas?error=${encodeURIComponent("Você não tem permissão para remover esta criança.")}`,
    );
  }

  try {
    await deleteChild(childId, session.familyId);
  } catch {
    redirect(`/quintal/configuracoes/criancas?error=${encodeURIComponent("Não foi possível remover. Tente de novo.")}`);
  }

  revalidatePath("/quintal/configuracoes/criancas");
  revalidatePath("/quintal/configuracoes");
  revalidatePath("/quintal");
  redirect("/quintal/configuracoes/criancas?removed=1");
}

// "Perfil" (Fase 20) — informações básicas (nome/nascimento/avatar/sexo).
// canEditChild (não canAccessChild): só quem tem permissão de EDIÇÃO
// altera o perfil — hoje as duas checagens coincidem (nenhum cuidador
// somente-leitura existe ainda, ver src/lib/authorization.ts), mas esta
// é a checagem certa para quando essa distinção existir.
export async function saveChildProfileAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const parsed = updateChildProfileInputSchema.safeParse({
    child_id: formData.get("child_id"),
    name: formData.get("name"),
    birth_date: formData.get("birth_date"),
    avatar_url: formData.get("avatar_url"),
    sex: formData.get("sex"),
  });

  const childId = String(formData.get("child_id") ?? "");
  const backTo = `/quintal/configuracoes/criancas/${childId}?aba=perfil`;

  if (!parsed.success) {
    redirect(`${backTo}&error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const allowed = await canEditChild(session.caregiverId, parsed.data.child_id);
  if (!allowed) {
    redirect(`/quintal/configuracoes/criancas?error=${encodeURIComponent("Criança inválida.")}`);
  }

  try {
    await updateChildProfile(parsed.data.child_id, {
      name: parsed.data.name,
      birthDate: parsed.data.birth_date,
      avatarUrl: parsed.data.avatar_url,
      sex: parsed.data.sex,
    });
  } catch {
    redirect(`${backTo}&error=${encodeURIComponent("Não foi possível salvar. Tente de novo.")}`);
  }

  revalidatePath(`/quintal/configuracoes/criancas/${childId}`);
  revalidatePath("/quintal/configuracoes/criancas");
  revalidatePath("/quintal/configuracoes");
  revalidatePath("/quintal");
  redirect(`${backTo}&success=1`);
}

// "Preferências" (Fase 20) — interesses + brincadeiras favoritas +
// materiais + rotina + alimentação (contexto, não o método em si — ver
// saveChildFeedingMethodAction) + observações dos cuidadores, tudo desta
// criança específica, nunca misturado com a de um irmão.
export async function saveChildPreferencesAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const parsed = childPreferencesInputSchema.safeParse({
    child_id: formData.get("child_id"),
    interests: formData.get("interests"),
    favorite_activities: formData.get("favorite_activities"),
    preferred_materials: formData.get("preferred_materials"),
    routine_preference: formData.get("routine_preference"),
    activity_style: formData.get("activity_style"),
    routine_notes: formData.get("routine_notes"),
    feeding_notes: formData.get("feeding_notes"),
    caregiver_notes: formData.get("caregiver_notes"),
  });

  const childId = String(formData.get("child_id") ?? "");
  const backTo = `/quintal/configuracoes/criancas/${childId}?aba=preferencias`;

  if (!parsed.success) {
    redirect(`${backTo}&error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const allowed = await canEditChild(session.caregiverId, parsed.data.child_id);
  if (!allowed) {
    redirect(`/quintal/configuracoes/criancas?error=${encodeURIComponent("Criança inválida.")}`);
  }

  try {
    await updateChildPreferences(parsed.data.child_id, {
      interests: parsed.data.interests,
      favoriteActivities: parsed.data.favorite_activities,
      preferredMaterials: parsed.data.preferred_materials,
      routinePreference: parsed.data.routine_preference,
      activityStyle: parsed.data.activity_style,
      routineNotes: parsed.data.routine_notes,
      feedingNotes: parsed.data.feeding_notes,
      caregiverNotes: parsed.data.caregiver_notes,
    });
  } catch {
    redirect(`${backTo}&error=${encodeURIComponent("Não foi possível salvar. Tente de novo.")}`);
  }

  revalidatePath(`/quintal/configuracoes/criancas/${childId}`);
  revalidatePath("/quintal/configuracoes/criancas");
  revalidatePath("/quintal");
  redirect(`${backTo}&success=1`);
}

// "Contexto > Sobre esta criança" (Fase 20) — observação livre e geral
// (children.notes), separada das observações por área da aba
// Preferências.
export async function saveChildContextNotesAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const parsed = updateChildContextNotesInputSchema.safeParse({
    child_id: formData.get("child_id"),
    notes: formData.get("notes"),
  });

  const childId = String(formData.get("child_id") ?? "");
  const backTo = `/quintal/configuracoes/criancas/${childId}?aba=contexto`;

  if (!parsed.success) {
    redirect(`${backTo}&error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const allowed = await canEditChild(session.caregiverId, parsed.data.child_id);
  if (!allowed) {
    redirect(`/quintal/configuracoes/criancas?error=${encodeURIComponent("Criança inválida.")}`);
  }

  try {
    await updateChildContextNotes(parsed.data.child_id, parsed.data.notes);
  } catch {
    redirect(`${backTo}&error=${encodeURIComponent("Não foi possível salvar. Tente de novo.")}`);
  }

  revalidatePath(`/quintal/configuracoes/criancas/${childId}`);
  redirect(`${backTo}&success=1`);
}

// "Perfil > Método alimentar" (Fase 20) — reaproveita 100% a lógica já
// usada por /quintal/alimentacao (updateChildFeedingMethod,
// feedingMethodInputSchema): esta fase pede explicitamente para não
// duplicar o módulo de Alimentação, só expor a mesma configuração aqui
// também. O registro do dia a dia das refeições continua só em
// /quintal/alimentacao.
export async function saveChildFeedingMethodAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const parsed = feedingMethodInputSchema.safeParse({
    child_id: formData.get("child_id"),
    method_id: formData.get("method_id"),
    method_custom: formData.get("method_custom"),
  });

  const childId = String(formData.get("child_id") ?? "");
  const backTo = `/quintal/configuracoes/criancas/${childId}?aba=perfil`;

  if (!parsed.success) {
    redirect(`${backTo}&error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const allowed = await canEditChild(session.caregiverId, parsed.data.child_id);
  if (!allowed) {
    redirect(`/quintal/configuracoes/criancas?error=${encodeURIComponent("Criança inválida.")}`);
  }

  try {
    await updateChildFeedingMethod(parsed.data.child_id, {
      methodId: parsed.data.method_id?.trim() || null,
      methodCustom: parsed.data.method_custom?.trim() || null,
    });
  } catch {
    redirect(`${backTo}&error=${encodeURIComponent("Não foi possível salvar. Tente de novo.")}`);
  }

  revalidatePath(`/quintal/configuracoes/criancas/${childId}`);
  revalidatePath("/quintal/alimentacao");
  redirect(`${backTo}&success=1#metodo`);
}
