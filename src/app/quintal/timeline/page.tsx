import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Moon, Sun, Utensils, Blocks, MapPin, ListChecks, Sparkles, Eye } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getSessionCaregiver } from "@/lib/authorization";
import { getActiveChildContext } from "@/lib/activeChild";
import { dayLabel } from "@/lib/format";
import {
  getDayTimeline,
  TIMELINE_FILTERS,
  TIMELINE_FILTER_LABELS,
  TIMELINE_FILTER_TYPES,
  isTimelineFilter,
  type TimelineIcon,
} from "@/lib/timeline";
import { eventOriginLabels } from "@/lib/validation/events";
import { cardClassName } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/FilterChips";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = {
  title: "Timeline — Quintal",
  robots: { index: false, follow: false },
};

const ICONS: Record<TimelineIcon, LucideIcon> = {
  sleep: Moon,
  wake: Sun,
  meal: Utensils,
  play: Blocks,
  outing: MapPin,
  routine: ListChecks,
  development: Sparkles,
  observation: Eye,
};

function parseDayParam(dia: string | undefined): Date {
  if (dia && /^\d{4}-\d{2}-\d{2}$/.test(dia)) {
    const [year, month, day] = dia.split("-").map(Number);
    const parsed = new Date(year, month - 1, day);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function toDayParam(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

// A Timeline central pedida nesta fase: todos os módulos (Alimentação,
// Sono, Brincadeiras, e o que já era criado via /ops — Rotina,
// Desenvolvimento, Passeio, Observação) numa única lista cronológica,
// um dia por vez, com filtro, e cada linha levando ao detalhe/edição/
// exclusão (src/app/quintal/timeline/[id]/page.tsx). Objetivo de UX
// explícito do pedido: parecer que "o Quintal está acompanhando o dia",
// não um sistema de registro — por isso nada de tabela densa, cada
// evento é uma linha com ícone, horário e no máximo duas linhas de
// detalhe.
export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; filtro?: string }>;
}) {
  const { dia, filtro } = await searchParams;
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  // Criança ATIVA (Fase 16) — trocada pelo seletor global no topo.
  const { active: activeChild } = await getActiveChildContext(session.caregiverId);

  if (!activeChild) {
    return (
      <PageContainer space={6}>
        <PageHeader title="Timeline" backHref="/quintal" backLabel="Quintal" />
        <p className={cardClassName("p-4 text-sm text-ink-muted")}>
          Nenhuma criança cadastrada ainda para esta família.
        </p>
      </PageContainer>
    );
  }

  const day = parseDayParam(dia);
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
  const dayEnd = addDays(dayStart, 1);
  const filter = isTimelineFilter(filtro) ? filtro : undefined;

  const allEntries = await getDayTimeline(activeChild.id, {
    since: dayStart.toISOString(),
    until: dayEnd.toISOString(),
  });

  const entries = filter
    ? allEntries.filter((entry) => (TIMELINE_FILTER_TYPES[filter] as string[]).includes(entry.type))
    : allEntries;

  const prevDayParam = toDayParam(addDays(dayStart, -1));
  const nextDayParam = toDayParam(addDays(dayStart, 1));
  const filterQuery = filter ? `&filtro=${filter}` : "";

  return (
    <PageContainer space={6}>
      <PageHeader title="Timeline" description={activeChild.name} backHref="/quintal" backLabel="Quintal" />

      <div className={cardClassName("flex items-center justify-between p-3")}>
        <Link
          href={`/quintal/timeline?dia=${prevDayParam}${filterQuery}`}
          className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-neutral/40 hover:text-ink"
          aria-label="Dia anterior"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Link>
        <span className="text-sm font-semibold text-ink">{dayLabel(dayStart.toISOString())}</span>
        <Link
          href={`/quintal/timeline?dia=${nextDayParam}${filterQuery}`}
          className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-neutral/40 hover:text-ink"
          aria-label="Próximo dia"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <FilterChips
        activeValue={filter ?? "todos"}
        options={[
          { value: "todos", label: "Todos", href: `/quintal/timeline?dia=${dia ?? toDayParam(dayStart)}` },
          ...TIMELINE_FILTERS.map((f) => ({
            value: f,
            label: TIMELINE_FILTER_LABELS[f],
            href: `/quintal/timeline?dia=${dia ?? toDayParam(dayStart)}&filtro=${f}`,
          })),
        ]}
      />

      {entries.length === 0 ? (
        <p className={cardClassName("p-4 text-sm text-ink-muted")}>
          {filter
            ? "Nada por aqui nesse filtro, nesse dia."
            : "Nada registrado ainda nesse dia — o dia da família aparece aqui assim que algo for registrado."}
        </p>
      ) : (
        <ol className="space-y-2">
          {entries.map((entry) => {
            const Icon = ICONS[entry.icon];
            return (
              <li key={entry.displayKey}>
                <Link
                  href={`/quintal/timeline/${entry.id}`}
                  className={cardClassName("flex items-start gap-3 p-3 transition-all duration-200 hover:shadow-[var(--shadow-lift)]")}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent">
                    <Icon className="h-4 w-4 text-ink" aria-hidden />
                  </span>
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
                    <p className="pt-0.5 text-[11px] text-ink-muted">{eventOriginLabels[entry.origin]}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </PageContainer>
  );
}
