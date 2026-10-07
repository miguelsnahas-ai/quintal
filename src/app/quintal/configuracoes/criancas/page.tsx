import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getSessionCaregiver, canManageFamily } from "@/lib/authorization";
import { getFamilyProfile } from "@/lib/familyContext";
import { ageLabel } from "@/lib/format";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import { Input, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { addChildAction, removeChildAction } from "./actions";

export const metadata: Metadata = {
  title: "Crianças — Configurações — Quintal",
  robots: { index: false, follow: false },
};

// Lista de crianças + adicionar (Fase 17, avatar/resumo contextual desde
// a Fase 20). Uma família pode ter múltiplas crianças — nada aqui assume
// uma só: cada card é só um resumo (avatar, nome, idade CALCULADA a
// partir de birth_date — nunca armazenada, ver ageLabel em
// src/lib/format.ts — data de nascimento e um resumo contextual já
// estruturado, sem consulta pesada por criança, ver
// summarizeChildContext em familyContext.ts), o contexto completo de cada
// uma vive só na própria página (/criancas/[id]), nunca misturado aqui.
export default async function CriancasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; removed?: string }>;
}) {
  const { error, success, removed } = await searchParams;
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const [profile, isOwner] = await Promise.all([
    getFamilyProfile(session.familyId),
    canManageFamily(session.caregiverId, session.familyId),
  ]);

  if (!profile) {
    redirect("/comecar");
  }

  return (
    <div className="space-y-6">
      <SettingsPageHeader title="Crianças" description="Quem faz parte da família" />

      <FieldError>{error}</FieldError>
      {success && <p className="text-sm text-ink-muted">Criança cadastrada.</p>}
      {removed && <p className="text-sm text-ink-muted">Criança removida.</p>}

      {profile.children.length === 0 ? (
        <p className="rounded-lg bg-primary p-4 text-sm text-ink-muted shadow-[var(--shadow-card)]">
          Nenhuma criança cadastrada ainda.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {profile.children.map((child) => {
            const initials = child.name
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase())
              .join("");

            return (
              <Card key={child.id} className="space-y-2 p-4">
                <Link
                  href={`/quintal/configuracoes/criancas/${child.id}`}
                  className="flex items-center gap-3"
                >
                  {child.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitrária, não um asset do projeto.
                    <img
                      src={child.avatarUrl}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-ink">
                      {initials || "?"}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{child.name}</p>
                    <p className="text-xs text-ink-muted">
                      {ageLabel(child.birthDate) ?? "Idade não informada"}
                      {child.birthDate
                        ? ` · nascida em ${new Date(child.birthDate).toLocaleDateString("pt-BR")}`
                        : ""}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                </Link>
                <p className="text-xs text-ink-muted">
                  {child.contextSummary ?? "Ainda sem preferências registradas."}
                </p>
                {isOwner && (
                  <details className="group">
                    <summary className="cursor-pointer list-none text-xs font-medium text-danger marker:content-none">
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
              </Card>
            );
          })}
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
    </div>
  );
}
