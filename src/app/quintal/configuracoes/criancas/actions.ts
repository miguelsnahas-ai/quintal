"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionCaregiver, canAccessChild, canManageFamily } from "@/lib/authorization";
import { createChild, deleteChild, updateChildEssentials } from "@/lib/familyContext";
import { addChildInputSchema, childEssentialsInputSchema } from "@/lib/validation/profile";

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
// regra (irreversível, restrita ao owner).
export async function removeChildAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const childId = String(formData.get("child_id") ?? "");

  const [hasAccess, isOwner] = await Promise.all([
    canAccessChild(session.caregiverId, childId),
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

// Movida de /quintal/perfil/actions.ts (Fase 17) — mesma função; o
// redirect agora volta pra página da criança específica (antes voltava
// pra uma página com todas as crianças numa lista só).
export async function saveChildEssentialsAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const parsed = childEssentialsInputSchema.safeParse({
    child_id: formData.get("child_id"),
    name: formData.get("name"),
    birth_date: formData.get("birth_date"),
    interests: formData.get("interests"),
  });

  const childId = String(formData.get("child_id") ?? "");
  const backTo = `/quintal/configuracoes/criancas/${childId}?aba=perfil`;

  if (!parsed.success) {
    redirect(`${backTo}&error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const allowed = await canAccessChild(session.caregiverId, parsed.data.child_id);
  if (!allowed) {
    redirect(`/quintal/configuracoes/criancas?error=${encodeURIComponent("Criança inválida.")}`);
  }

  try {
    await updateChildEssentials(parsed.data.child_id, {
      name: parsed.data.name,
      birthDate: parsed.data.birth_date,
      interests: parsed.data.interests,
    });
  } catch {
    redirect(`${backTo}&error=${encodeURIComponent("Não foi possível salvar. Tente de novo.")}`);
  }

  // Dashboard e a sidebar de Configurações também mostram nome/idade —
  // mantém tudo em sincronia.
  revalidatePath(`/quintal/configuracoes/criancas/${childId}`);
  revalidatePath("/quintal/configuracoes/criancas");
  revalidatePath("/quintal/configuracoes");
  revalidatePath("/quintal");
  redirect(`${backTo}&success=1`);
}
