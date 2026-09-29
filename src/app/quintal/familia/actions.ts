"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionCaregiver, canAccessChild, canManageFamily, canInviteCaregiver, type SessionCaregiver } from "@/lib/authorization";
import { createChild, deleteChild } from "@/lib/familyContext";
import { createInvitation, revokeInvitation, resendInvitation } from "@/lib/invitations";
import { addChildInputSchema } from "@/lib/validation/profile";
import { createInvitationInputSchema } from "@/lib/validation/invitation";

async function requireSession(): Promise<SessionCaregiver> {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }
  return session;
}

// "O owner terá acesso automaticamente" (pedido desta fase) — mas
// qualquer cuidador da família pode adicionar uma criança, não só o
// owner: cadastrar quem faz parte da família é conteúdo do dia a dia,
// não administração (essa distinção é a mesma que já separa "editar
// perfil da criança" de "gerenciar cuidadores/convites" — só o segundo
// é restrito ao owner, ver canManageFamily/canInviteCaregiver).
export async function addChildAction(formData: FormData) {
  const session = await requireSession();

  const parsed = addChildInputSchema.safeParse({
    name: formData.get("name"),
    birth_date: formData.get("birth_date"),
  });

  if (!parsed.success) {
    redirect(`/quintal/familia?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  try {
    await createChild(session.familyId, { name: parsed.data.name, birthDate: parsed.data.birth_date });
  } catch {
    redirect(`/quintal/familia?error=${encodeURIComponent("Não foi possível cadastrar. Tente de novo.")}`);
  }

  revalidatePath("/quintal/familia");
  revalidatePath("/quintal");
  redirect("/quintal/familia?success=1");
}

// Remoção é irreversível (apaga o histórico da criança junto) — por
// isso, diferente de adicionar, fica restrita ao owner (canManageFamily),
// mesmo padrão de "ação destrutiva pede o nível de permissão mais alto"
// já usado em /ops.
export async function removeChildAction(formData: FormData) {
  const session = await requireSession();
  const childId = String(formData.get("child_id") ?? "");

  const [hasAccess, isOwner] = await Promise.all([
    canAccessChild(session.caregiverId, childId),
    canManageFamily(session.caregiverId, session.familyId),
  ]);

  if (!hasAccess || !isOwner) {
    redirect(`/quintal/familia?error=${encodeURIComponent("Você não tem permissão para remover esta criança.")}`);
  }

  try {
    await deleteChild(childId, session.familyId);
  } catch {
    redirect(`/quintal/familia?error=${encodeURIComponent("Não foi possível remover. Tente de novo.")}`);
  }

  revalidatePath("/quintal/familia");
  revalidatePath("/quintal");
  redirect("/quintal/familia?removed=1");
}

export async function createInvitationAction(formData: FormData) {
  const session = await requireSession();

  const allowed = await canInviteCaregiver(session.caregiverId, session.familyId);
  if (!allowed) {
    redirect(`/quintal/familia?error=${encodeURIComponent("Só quem administra a família pode convidar cuidadores.")}`);
  }

  const parsed = createInvitationInputSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    redirect(`/quintal/familia?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  try {
    await createInvitation({
      familyId: session.familyId,
      invitedBy: session.caregiverId,
      name: parsed.data.name,
      email: parsed.data.email,
      accessRole: "caregiver",
    });
  } catch {
    redirect(`/quintal/familia?error=${encodeURIComponent("Não foi possível criar o convite. Tente de novo.")}`);
  }

  revalidatePath("/quintal/familia");
  redirect("/quintal/familia?invited=1");
}

export async function revokeInvitationAction(formData: FormData) {
  const session = await requireSession();
  const allowed = await canManageFamily(session.caregiverId, session.familyId);
  if (!allowed) {
    redirect(`/quintal/familia?error=${encodeURIComponent("Só quem administra a família pode cancelar convites.")}`);
  }

  const invitationId = String(formData.get("invitation_id") ?? "");

  try {
    await revokeInvitation(invitationId, session.familyId);
  } catch {
    redirect(`/quintal/familia?error=${encodeURIComponent("Não foi possível cancelar o convite.")}`);
  }

  revalidatePath("/quintal/familia");
  redirect("/quintal/familia");
}

export async function resendInvitationAction(formData: FormData) {
  const session = await requireSession();
  const allowed = await canManageFamily(session.caregiverId, session.familyId);
  if (!allowed) {
    redirect(`/quintal/familia?error=${encodeURIComponent("Só quem administra a família pode reenviar convites.")}`);
  }

  const invitationId = String(formData.get("invitation_id") ?? "");

  try {
    await resendInvitation(invitationId, session.familyId);
  } catch {
    redirect(`/quintal/familia?error=${encodeURIComponent("Não foi possível gerar um novo link.")}`);
  }

  revalidatePath("/quintal/familia");
  redirect("/quintal/familia?resent=1");
}
