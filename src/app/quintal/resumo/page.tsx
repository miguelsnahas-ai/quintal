import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { getSessionCaregiver } from "@/lib/authorization";
import { getActiveChildContext } from "@/lib/activeChild";
import {
  getCaregiverSummary,
  formatCaregiverSummaryText,
  CAREGIVER_SUMMARY_PERIODS,
  CAREGIVER_SUMMARY_PERIOD_LABELS,
  isCaregiverSummaryPeriod,
} from "@/lib/caregiverSummary";
import { cardClassName, inviteCardClassName } from "@/components/ui/Card";
import { buttonClassName } from "@/components/ui/Button";
import { FilterChips } from "@/components/ui/FilterChips";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { TimelineEventIcon } from "@/components/dashboard/TimelineEventIcon";

export const metadata: Metadata = {
  title: "Resumo — Quintal",
  robots: { index: false, follow: false },
};

// Pedido explícito: uma função de resumo pra um cuidador que não está
// ativamente presente, mas quer saber o que está acontecendo com o
// filho — qualquer cuidador da família pode abrir esta tela a qualquer
// momento (mesma checagem de acesso do resto de /quintal, nada de novo
// aqui) e escolher o período. Compartilhar por WhatsApp usa o mesmo
// padrão de CopyInviteLink: um link wa.me com o texto pronto — o
// Quintal nunca manda a mensagem sozinho, quem decide o destinatário é
// a própria família.
export default async function ResumoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo } = await searchParams;
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const { active: activeChild } = await getActiveChildContext(session.caregiverId);

  if (!activeChild) {
    return (
      <PageContainer space={6}>
        <PageHeader title="Resumo" />
        <p className={cardClassName("p-4 text-sm text-ink-muted")}>
          Nenhuma criança cadastrada ainda para esta família.
        </p>
      </PageContainer>
    );
  }

  const period = isCaregiverSummaryPeriod(periodo) ? periodo : "today";
  const summary = await getCaregiverSummary(activeChild.id, activeChild.name, period);
  const shareText = formatCaregiverSummaryText(summary);
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const hasAnything = summary.highlights.length > 0;

  return (
    <PageContainer space={6}>
      <PageHeader
        title="Resumo"
        description={`Pra quem quer se atualizar sobre ${activeChild.name} sem abrir cada módulo.`}
      />

      <FilterChips
        activeValue={period}
        options={CAREGIVER_SUMMARY_PERIODS.map((p) => ({
          value: p,
          label: CAREGIVER_SUMMARY_PERIOD_LABELS[p],
          href: `/quintal/resumo?periodo=${p}`,
        }))}
      />

      {hasAnything ? (
        <section className={cardClassName("space-y-2 p-4")}>
          {summary.highlights.map((highlight) => (
            <div key={highlight.type} className="flex items-center gap-2.5 text-sm text-ink">
              <TimelineEventIcon type={highlight.icon} size="sm" />
              <span>{highlight.label}</span>
            </div>
          ))}
        </section>
      ) : (
        <p className={inviteCardClassName("p-4 text-sm text-ink-muted")}>
          Nada registrado ainda nesse período.
        </p>
      )}

      <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={buttonClassName("secondary", "w-full justify-center")}>
        <MessageCircle className="h-4 w-4" aria-hidden />
        Compartilhar por WhatsApp
      </a>

      {summary.dayGroups.length > 0 && (
        <section className="space-y-4">
          {summary.dayGroups.map((group) => (
            <div key={group.label} className="space-y-2">
              <h2 className="text-sm font-semibold text-ink">{group.label}</h2>
              <ol className="space-y-2">
                {group.entries.map((entry) => (
                  <li key={entry.id} className={cardClassName("flex items-start gap-3 p-3")}>
                    <TimelineEventIcon type={entry.icon} />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-semibold text-ink">{entry.verb}</p>
                        <span className="shrink-0 font-mono text-xs text-ink-muted">{entry.timeLabel}</span>
                      </div>
                      {entry.detailLines.map((line) => (
                        <p key={line} className="text-sm text-ink-muted">
                          {line}
                        </p>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </section>
      )}
    </PageContainer>
  );
}
