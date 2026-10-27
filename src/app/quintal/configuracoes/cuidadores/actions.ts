"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionCaregiver, canManageFamily, canInviteCaregiver } from "@/lib/authorization";
import { createInvitation, revokeInvitation, resendInvitation } from "@/lib/invitations";
import { removeCaregiver } from "@/lib/familyContext";
import { createInvitationInputSchema } from "@/lib/validation/invitation";

// Movidas de /quintal/familia/actions.ts (Fase 17) — mesmas funções,
// mesmas regras (restritas a quem administra a família).
export async function createInvitationAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const allowed = await canInviteCaregiver(session.caregiverId, session.familyId);
  if (!allowed) {
    redirect(
      `/quintal/configuracoes/cuidadores?aba=convidar&error=${encodeURIComponent("Só quem administra a família pode convidar cuidadores.")}`,
    );
  }

  const parsed = createInvitationInputSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    redirect(
      `/quintal/configuracoes/cuidadores?aba=convidar&error=${encodeURIComponent(parsed.error.issues[0].message)}`,
    );
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
    redirect(
      `/quintal/configuracoes/cuidadores?aba=convidar&error=${encodeURIComponent("Não foi possível criar o convite. Tente de novo.")}`,
    );
  }

  revalidatePath("/quintal/configuracoes/cuidadores");
  revalidatePath("/quintal/configuracoes");
  redirect("/quintal/configuracoes/cuidadores?aba=convites&invited=1");
}

export async function revokeInvitationAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const allowed = await canManageFamily(session.caregiverId, session.familyId);
  if (!allowed) {
    redirect(
      `/quintal/configuracoes/cuidadores?aba=convites&error=${encodeURIComponent("Só quem administra a família pode cancelar convites.")}`,
    );
  }

  const invitationId = String(formData.get("invitation_id") ?? "");

  try {
    await revokeInvitation(invitationId, session.familyId);
  } catch {
    redirect(
      `/quintal/configuracoes/cuidadores?aba=convites&error=${encodeURIComponent("Não foi possível cancelar o convite.")}`,
    );
  }

  revalidatePath("/quintal/configuracoes/cuidadores");
  redirect("/quintal/configuracoes/cuidadores?aba=convites");
}

export async function resendInvitationAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const allowed = await canManageFamily(session.caregiverId, session.familyId);
  if (!allowed) {
    redirect(
      `/quintal/configuracoes/cuidadores?aba=convites&error=${encodeURIComponent("Só quem administra a família pode reenviar convites.")}`,
    );
  }

  const invitationId = String(formData.get("invitation_id") ?? "");

  try {
    await resendInvitation(invitationId, session.familyId);
  } catch {
    redirect(
      `/quintal/configuracoes/cuidadores?aba=convites&error=${encodeURIComponent("Não foi possível gerar um novo link.")}`,
    );
  }

  revalidatePath("/quintal/configuracoes/cuidadores");
  redirect("/quintal/configuracoes/cuidadores?aba=convites&resent=1");
}

// "Remover cuidador" (revisão da área de Configurações) — restrita ao
// owner, mesma regra de removeChildAction. removeCaregiver (familyContext.ts)
// já recusa remover um owner, mas a mensagem de erro chega igual até
// aqui se alguém tentar via um formulário adulterado.
export async function removeCaregiverAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const allowed = await canManageFamily(session.caregiverId, session.familyId);
  if (!allowed) {
    redirect(
      `/quintal/configuracoes/cuidadores?aba=ativos&error=${encodeURIComponent("Só quem administra a família pode remover cuidadores.")}`,
    );
  }

  const caregiverId = String(formData.get("caregiver_id") ?? "");

  try {
    await removeCaregiver(caregiverId, session.familyId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível remover. Tente de novo.";
    redirect(`/quintal/configuracoes/cuidadores?aba=ativos&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/quintal/configuracoes/cuidadores");
  revalidatePath("/quintal/configuracoes");
  redirect("/quintal/configuracoes/cuidadores?aba=ativos&removed=1");
}
