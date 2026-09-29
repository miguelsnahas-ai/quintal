import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { RotateCw, Ban, Copy, ShieldCheck } from "lucide-react";
import { getSessionCaregiver, canManageFamily } from "@/lib/authorization";
import { getFamilyProfile } from "@/lib/familyContext";
import { getFamilyInvitations, type FamilyInvitation } from "@/lib/invitations";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import SettingsTabs from "@/components/settings/SettingsTabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createInvitationAction, revokeInvitationAction, resendInvitationAction, removeCaregiverAction } from "./actions";

export const metadata: Metadata = {
  title: "Cuidadores — Configurações — Quintal",
  robots: { index: false, follow: false },
};

const BASE_PATH = "/quintal/configuracoes/cuidadores";
const TABS = [
  { value: "ativos", label: "Ativos" },
  { value: "convites", label: "Convites pendentes" },
  { value: "permissoes", label: "Permissões" },
  { value: "convidar", label: "Convidar cuidador" },
];

const INVITATION_STATUS_LABELS: Record<FamilyInvitation["status"], string> = {
  pending: "Convite pendente",
  accepted: "Aceito",
  expired: "Expirado",
  revoked: "Cancelado",
};

// "Cuidadores" (Fase 17) — Ativos e Convites pendentes reaproveitam o
// que já existia em /quintal/familia; Permissões é a única aba
// genuinamente nova, e ainda sem lógica por trás (pedido explícito desta
// etapa: não implementar controle de permissões agora, só preparar
// onde ele vai morar).
export default async function CuidadoresPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; error?: string; invited?: string; resent?: string; removed?: string }>;
}) {
  const { aba, error, invited, resent, removed } = await searchParams;
  const activeTab = TABS.some((tab) => tab.value === aba) ? aba! : TABS[0].value;

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
    <div className="space-y-6">
      <SettingsPageHeader title="Cuidadores" description="Quem tem acesso à família" />
      <SettingsTabs basePath={BASE_PATH} tabs={TABS} active={activeTab} />

      <FieldError>{error}</FieldError>
      {invited && <p className="text-sm text-ink-muted">Convite criado — copie o link na aba de convites.</p>}
      {resent && <p className="text-sm text-ink-muted">Novo link gerado.</p>}
      {removed && <p className="text-sm text-ink-muted">Cuidador removido.</p>}

      {activeTab === "ativos" && (
        <Card className="divide-y divide-neutral">
          {profile.caregivers.map((caregiver) => (
            <div key={caregiver.id} className="space-y-1.5 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="font-medium text-ink">{caregiver.name}</span>
                  {caregiver.id === session.caregiverId && <span className="text-ink-muted"> (você)</span>}
                  <div className="text-xs text-ink-muted">
                    {caregiver.accessRole === "owner" ? "Administrador(a)" : "Cuidador(a)"}
                    {caregiver.role ? ` · ${caregiver.role}` : ""}
                  </div>
                </div>
              </div>
              {isOwner && caregiver.accessRole !== "owner" && (
                <details className="group">
                  <summary className="cursor-pointer list-none text-xs font-medium text-danger marker:content-none">
                    Remover
                  </summary>
                  <form action={removeCaregiverAction} className="mt-1.5 space-y-1.5">
                    <input type="hidden" name="caregiver_id" value={caregiver.id} />
                    <p className="text-[11px] text-ink-muted">
                      Remove {caregiver.name} da família. A sessão dela é encerrada e o acesso às crianças é
                      revogado imediatamente. Não pode ser desfeito.
                    </p>
                    <Button type="submit" variant="danger" className="px-2 py-1 text-xs">
                      Confirmar remoção
                    </Button>
                  </form>
                </details>
              )}
            </div>
          ))}
        </Card>
      )}

      {activeTab === "convites" && (
        <div className="space-y-3">
          {pendingInvitations.length === 0 ? (
            <p className="rounded-lg bg-primary p-4 text-sm text-ink-muted shadow-[var(--shadow-card)]">
              Nenhum convite pendente agora.
            </p>
          ) : (
            <Card className="divide-y divide-neutral">
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
                            className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-neutral/40 hover:text-danger"
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
          )}

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
        </div>
      )}

      {activeTab === "permissoes" && (
        <EmptyState
          icon={ShieldCheck}
          title="Permissões em breve"
          description="Hoje todo cuidador vê todas as crianças da família. Em breve você vai poder restringir o acesso de um cuidador a crianças específicas, ou dar acesso só de leitura."
        />
      )}

      {activeTab === "convidar" &&
        (isOwner ? (
          <form action={createInvitationAction} className="space-y-3 rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]">
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
        ) : (
          <p className="rounded-lg bg-primary p-4 text-sm text-ink-muted shadow-[var(--shadow-card)]">
            Só quem administra a família pode convidar novos cuidadores.
          </p>
        ))}
    </div>
  );
}
