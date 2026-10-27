import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import type { AccessRole } from "@/lib/authorization";

// ---------------------------------------------------------------------
// Fase 16 — convites de cuidador. Sem canal de e-mail de verdade neste
// produto (só WhatsApp): um convite vira um LINK que o owner copia e
// manda como quiser, mesmo padrão já usado para o "Link de teste" de um
// cuidador em /ops/families/[id]. `email`/`name` ficam só como
// referência de para quem o link foi pensado — nunca disparam nada
// automaticamente.
// ---------------------------------------------------------------------

const INVITATION_EXPIRY_DAYS = 14;

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export type FamilyInvitation = {
  id: string;
  email: string | null;
  name: string | null;
  accessRole: AccessRole;
  status: InvitationStatus;
  token: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
};

function isPast(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

// Convites pendentes cujo prazo já passou viram "expired" na leitura —
// sem cron, sem trigger: o único lugar que lê a lista de convites de uma
// família (a página do owner) é também o único lugar que precisa dessa
// verdade atualizada.
export async function getFamilyInvitations(familyId: string): Promise<FamilyInvitation[]> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("family_invitations")
    .select("id, email, name, access_role, status, token, created_at, expires_at, accepted_at")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false });

  const rows = data ?? [];
  const staleIds = rows.filter((row) => row.status === "pending" && isPast(row.expires_at)).map((row) => row.id);
  if (staleIds.length > 0) {
    await supabase.from("family_invitations").update({ status: "expired" }).in("id", staleIds);
  }

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    accessRole: row.access_role as AccessRole,
    status: staleIds.includes(row.id) ? "expired" : (row.status as InvitationStatus),
    token: row.token,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
  }));
}

export async function createInvitation(input: {
  familyId: string;
  invitedBy: string;
  name: string | null;
  email: string | null;
  accessRole: AccessRole;
}): Promise<{ token: string }> {
  const supabase = createServiceClient();
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("family_invitations").insert({
    family_id: input.familyId,
    invited_by: input.invitedBy,
    name: input.name,
    email: input.email,
    access_role: input.accessRole,
    token,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { token };
}

// Só revoga um convite ainda pendente — um já aceito é história, não
// tem "cancelar" depois do fato.
export async function revokeInvitation(invitationId: string, familyId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("family_invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId)
    .eq("family_id", familyId)
    .eq("status", "pending");

  if (error) {
    throw new Error(error.message);
  }
}

// "Reenviar" aqui é gerar um link novo com prazo novo — o link antigo
// para de bater com qualquer convite válido assim que o token muda.
// Funciona tanto para um convite pendente (renova o prazo) quanto para
// um expirado/revogado (reativa).
export async function resendInvitation(invitationId: string, familyId: string): Promise<{ token: string }> {
  const supabase = createServiceClient();
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("family_invitations")
    .update({ token, expires_at: expiresAt, status: "pending" })
    .eq("id", invitationId)
    .eq("family_id", familyId)
    .neq("status", "accepted")
    .select("token")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Convite não encontrado.");
  }

  return { token: data.token };
}

export type InvitationLookup = {
  id: string;
  familyId: string;
  familyName: string;
  invitedByName: string | null;
  accessRole: AccessRole;
  status: InvitationStatus;
  isExpired: boolean;
};

// Consulta pública (a página /convite/[token] não tem sessão de família
// ainda) — expõe só o necessário pra mostrar "Você foi convidado para a
// família X" antes de aceitar, nunca dados sensíveis da família.
export async function getInvitationByToken(token: string): Promise<InvitationLookup | null> {
  const supabase = createServiceClient();

  const { data: invitation } = await supabase
    .from("family_invitations")
    .select("id, family_id, access_role, status, expires_at, invited_by")
    .eq("token", token)
    .maybeSingle();

  if (!invitation) return null;

  const [{ data: family }, { data: inviter }] = await Promise.all([
    supabase.from("families").select("name").eq("id", invitation.family_id).maybeSingle(),
    invitation.invited_by
      ? supabase.from("caregivers").select("name").eq("id", invitation.invited_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!family) return null;

  return {
    id: invitation.id,
    familyId: invitation.family_id,
    familyName: family.name,
    invitedByName: inviter?.name ?? null,
    accessRole: invitation.access_role as AccessRole,
    status: invitation.status as InvitationStatus,
    isExpired: invitation.status === "pending" && isPast(invitation.expires_at),
  };
}

// Aceitar um convite (Fase 16): cria um caregiver novo na família
// convidada, vincula (caregiver_child) a toda criança já existente
// dessa família — mesmo comportamento que todo cuidador já tem hoje,
// backfillado explicitamente pela migração desta fase — abre uma sessão
// e marca o convite como aceito. Tudo isto atrás de UMA verificação
// central: um número de telefone só pode ser cuidador de uma família por
// vez neste MVP (caregivers.phone_number é único globalmente) — ver o
// comentário sobre isso em src/lib/authorization.ts. Se o telefone já
// pertence a outra família, a aceitação é recusada explicitamente, nunca
// silenciosamente ignorada.
export async function acceptInvitation(
  token: string,
  input: { name: string; phoneNumber: string },
): Promise<{ caregiverId: string } | { error: string }> {
  const supabase = createServiceClient();

  const { data: invitation } = await supabase
    .from("family_invitations")
    .select("id, family_id, access_role, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!invitation) return { error: "Convite não encontrado." };
  if (invitation.status === "accepted") return { error: "Esse convite já foi usado." };
  if (invitation.status === "revoked") return { error: "Esse convite foi cancelado." };
  if (invitation.status === "expired" || isPast(invitation.expires_at)) {
    return { error: "Esse convite expirou — peça um novo link." };
  }

  const { data: existingCaregiver } = await supabase
    .from("caregivers")
    .select("id, family_id")
    .eq("phone_number", input.phoneNumber)
    .maybeSingle();

  if (existingCaregiver && existingCaregiver.family_id !== invitation.family_id) {
    return {
      error:
        "Esse WhatsApp já está associado a outra família no Quintal. Por enquanto, um cuidador só pode participar de uma família.",
    };
  }

  // Já é cuidador desta MESMA família (ex.: reabriu o link por engano) —
  // trata como já aceito, sem duplicar.
  if (existingCaregiver) {
    await supabase.from("family_invitations").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", invitation.id);
    return { caregiverId: existingCaregiver.id };
  }

  const { data: newCaregiver, error: caregiverError } = await supabase
    .from("caregivers")
    .insert({
      family_id: invitation.family_id,
      name: input.name,
      phone_number: input.phoneNumber,
      access_role: invitation.access_role,
      is_primary_contact: false,
    })
    .select("id")
    .single();

  if (caregiverError || !newCaregiver) {
    return { error: "Não foi possível criar o cadastro. Tente de novo." };
  }

  const { data: existingChildren } = await supabase.from("children").select("id").eq("family_id", invitation.family_id);
  if (existingChildren && existingChildren.length > 0) {
    await supabase
      .from("caregiver_child")
      .insert(existingChildren.map((child) => ({ caregiver_id: newCaregiver.id, child_id: child.id })));
  }

  await supabase
    .from("family_invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  return { caregiverId: newCaregiver.id };
}
