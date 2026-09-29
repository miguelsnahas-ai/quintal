import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { UserPlus, RotateCw, Ban, Copy } from "lucide-react";
import { getSessionCaregiver, canManageFamily } from "@/lib/authorization";
import { getFamilyProfile } from "@/lib/familyContext";
import { getFamilyInvitations, type FamilyInvitation } from "@/lib/invitations";
import { ageLabel } from "@/lib/format";
import { Input, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  addChildAction,
  removeChildAction,
  createInvitationAction,
  revokeInvitationAction,
  resendInvitationAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Minha família — Quintal",
  robots: { index: false, follow: false },
};

const INVITATION_STATUS_LABELS: Record<FamilyInvitation["status"], string> = {
  pending: "Convite pendente",
  accepted: "Aceito",
  expired: "Expirado",
  revoked: "Cancelado",
};

// "Minha família" (Fase 16) — o hub da família: quem são as crianças
// (com um jeito simples de adicionar mais uma) e quem são os cuidadores
// (com o fluxo de convite). Deliberadamente não uma interface
// administrativa completa: editar os dados de uma criança continua em
// /quintal/perfil (não duplicado aqui), e gerenciar cuidadores/convites
// fica restrito a quem administra a família (canManageFamily/
// canInviteCaregiver) — o resto da família só vê.
export default async function FamiliaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; invited?: string; removed?: string; resent?: string }>;
}) {
  const { error, success, invited, removed, resent } = await searchParams;
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const [profile, invitations, isOwner, headersList] = await Promise.all([
    getFamilyProfile(session.familyId),
    getFamilyInvitations(session.familyId),
    canManageFamily(session.caregiverId, session.familyId),
    headers(),
  ]);

  if (!profile) {
    redirect("/comecar");
  }

  const origin = `${headersList.get("x-forwarded-proto") ?? "https"}://${headersList.get("host")}`;
  const pendingInvitations = invitations.filter((invitation) => invitation.status === "pending");
  const pastInvitations = invitations.filter((invitation) => invitation.status !== "pending");

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 px-4 py-6">
      <div>
        <Link href="/quintal" className="text-sm text-ink-muted hover:text-ink">
          ← Quintal
        </Link>
        <h1 className="text-lg font-bold text-ink">Minha família</h1>
        <p className="text-sm text-ink-muted">{profile.family.name}</p>
      </div>

      <FieldError>{error}</FieldError>
      {success && <p className="text-sm text-ink-muted">Criança cadastrada.</p>}
      {removed && <p className="text-sm text-ink-muted">Criança removida.</p>}
      {invited && <p className="text-sm text-ink-muted">Convite criado — copie o link abaixo para enviar.</p>}
      {resent && <p className="text-sm text-ink-muted">Novo link gerado.</p>}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink-muted">Crianças</h2>
        {profile.children.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {profile.children.map((child) => (
              <Card key={child.id} className="space-y-2 p-4">
                <div>
                  <p className="font-semibold text-ink">{child.name}</p>
                  <p className="text-xs text-ink-muted">{ageLabel(child.birthDate) ?? "Idade não informada"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/quintal/perfil" className="text-xs font-medium text-ink underline underline-offset-2">
                    Editar
                  </Link>
                  {isOwner && (
                    <details className="group">
                      <summary className="cursor-pointer list-none text-xs font-medium text-red-600 marker:content-none">
                        Remover
                      </summary>
                      <form action={removeChildAction} className="mt-1.5 space-y-1.5">
                        <input type="hidden" name="child_id" value={child.id} />
                        <p className="text-[11px] text-ink-muted">
                          Remove {child.name} e todo o histórico dela. Não pode ser desfeito.
                        </p>
                        <Button type="submit" variant="danger" className="w-full justify-center px-2 py-1 text-xs">
                          Confirmar remoção
                        </Button>
                      </form>
                    </details>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        <details className="group rounded-lg bg-primary shadow-[var(--shadow-card)]">
          <summary className="cursor-pointer list-none p-4 text-sm font-medium text-ink marker:content-none">
            <span className="inline-flex items-center gap-1.5">
              + Adicionar criança
              <span className="text-ink-muted transition-transform duration-200 group-open:rotate-90">›</span>
            </span>
          </summary>
          <form action={addChildAction} className="space-y-3 border-t border-neutral p-4">
            <div className="space-y-1">
              <Label htmlFor="child_name">Nome</Label>
              <Input id="child_name" name="name" required autoFocus />
            </div>
            <div className="space-y-1">
              <Label htmlFor="child_birth_date">Data de nascimento</Label>
              <Input id="child_birth_date" type="date" name="birth_date" />
            </div>
            <Button type="submit">Adicionar criança</Button>
          </form>
        </details>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink-muted">Cuidadores</h2>
        <Card className="divide-y divide-neutral">
          {profile.caregivers.map((caregiver) => (
            <div key={caregiver.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <span className="font-medium text-ink">{caregiver.name}</span>
                {caregiver.id === session.caregiverId && <span className="text-ink-muted"> (você)</span>}
                <div className="text-xs text-ink-muted">
                  {caregiver.accessRole === "owner" ? "Administrador(a)" : "Cuidador(a)"}
                  {caregiver.role ? ` · ${caregiver.role}` : ""}
                </div>
              </div>
            </div>
          ))}
          {pendingInvitations.map((invitation) => (
            <div key={invitation.id} className="space-y-2 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="font-medium text-ink">{invitation.name ?? "Convite"}</span>
                  <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                    <Badge>{INVITATION_STATUS_LABELS[invitation.status]}</Badge>
                  </div>
                </div>
                {isOwner && (
                  <div className="flex items-center gap-1">
                    <form action={resendInvitationAction}>
                      <input type="hidden" name="invitation_id" value={invitation.id} />
                      <button
                        type="submit"
                        aria-label="Gerar novo link"
                        className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-neutral/40 hover:text-ink"
                      >
                        <RotateCw className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </form>
                    <form action={revokeInvitationAction}>
                      <input type="hidden" name="invitation_id" value={invitation.id} />
                      <button
                        type="submit"
                        aria-label="Cancelar convite"
                        className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-neutral/40 hover:text-red-600"
                      >
                        <Ban className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </form>
                  </div>
                )}
              </div>
              {isOwner && (
                <div className="flex items-center gap-1.5 rounded-sm bg-secondary px-2 py-1.5 text-[11px] text-ink-muted">
                  <Copy className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="truncate">{`${origin}/convite/${invitation.token}`}</span>
                </div>
              )}
            </div>
          ))}
        </Card>

        {isOwner && pastInvitations.length > 0 && (
          <details className="rounded-lg bg-primary shadow-[var(--shadow-card)]">
            <summary className="cursor-pointer list-none p-3 text-xs font-medium text-ink-muted marker:content-none">
              Convites anteriores ({pastInvitations.length})
            </summary>
            <div className="divide-y divide-neutral border-t border-neutral">
              {pastInvitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between px-4 py-2 text-xs">
                  <span className="text-ink">{invitation.name ?? "Convite"}</span>
                  <Badge>{INVITATION_STATUS_LABELS[invitation.status]}</Badge>
                </div>
              ))}
            </div>
          </details>
        )}

        {isOwner ? (
          <details className="group rounded-lg bg-primary shadow-[var(--shadow-card)]">
            <summary className="cursor-pointer list-none p-4 text-sm font-medium text-ink marker:content-none">
              <span className="inline-flex items-center gap-1.5">
                <UserPlus className="h-4 w-4" aria-hidden />
                Adicionar cuidador
                <span className="text-ink-muted transition-transform duration-200 group-open:rotate-90">›</span>
              </span>
            </summary>
            <form action={createInvitationAction} className="space-y-3 border-t border-neutral p-4">
              <div className="space-y-1">
                <Label htmlFor="invite_name">Nome</Label>
                <Input id="invite_name" name="name" placeholder="Ex.: Avó Maria" required autoFocus />
              </div>
              <div className="space-y-1">
                <Label htmlFor="invite_email">E-mail (opcional, só para sua referência)</Label>
                <Input id="invite_email" type="email" name="email" placeholder="ex@exemplo.com" />
              </div>
              <p className="text-xs text-ink-muted">
                Você vai receber um link para copiar e mandar por WhatsApp — o Quintal ainda não envia
                convites automaticamente.
              </p>
              <Button type="submit">Gerar convite</Button>
            </form>
          </details>
        ) : (
          <p className="rounded-lg bg-primary p-4 text-xs text-ink-muted shadow-[var(--shadow-card)]">
            Só quem administra a família pode convidar novos cuidadores.
          </p>
        )}
      </section>
    </div>
  );
}
