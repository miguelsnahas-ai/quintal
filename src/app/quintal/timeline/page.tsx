import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getSessionCaregiver } from "@/lib/authorization";
import { getActiveChildContext } from "@/lib/activeChild";
import { dayLabel } from "@/lib/format";
import {
  getDayTimeline,
  TIMELINE_FILTERS,
  TIMELINE_FILTER_LABELS,
  TIMELINE_FILTER_TYPES,
  SUGGESTION_KIND_TO_FILTER,
  isTimelineFilter,
  type TimelineDisplayEntry,
} from "@/lib/timeline";
import { getRoutineSuggestions, getFullDayRoutine, type RoutineSuggestion } from "@/lib/routineEngine";
import { eventOriginLabels } from "@/lib/validation/events";
import { cardClassName, inviteCardClassName, cardHoverLift } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/FilterChips";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { TimelineEventIcon, ROUTINE_SUGGESTION_ICONS } from "@/components/dashboard/TimelineEventIcon";
import { QuintalIcon } from "@/components/icon/QuintalIcon";

export const metadata: Metadata = {
  title: "Timeline — Quintal",
  robots: { index: false, follow: false },
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

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// A agenda unificada: o dia registrado (eventos já acontecidos) e as
// sugestões da rotina adaptativa (routineEngine.ts) numa única lista
// cronológica — pedido explícito desta fase, para que "Ver agenda
// completa" (link de UpcomingMoments na Home) entregue de fato uma
// agenda completa, não só o histórico. Sugestão nunca é fato: continua
// com o mesmo tom "convite"/sem borda de UpcomingMoments, nunca o
// cardClassName sólido/bordado dos eventos já registrados. Duas fontes
// diferentes de sugestão, nunca as duas ao mesmo tempo: HOJE usa
// getRoutineSuggestions (só o resto do dia, a partir de `now` real); de
// amanhã em diante usa getFullDayRoutine (uma proposta do dia inteiro,
// pedido explícito desta fase — ver routineEngine.ts). Dias passados não
// têm sugestão nenhuma — não existe "proposta" pra um dia que já foi.
type AgendaRow =
  | { kind: "registered"; sortAt: string; entry: TimelineDisplayEntry }
  | { kind: "suggested"; sortAt: string; suggestion: RoutineSuggestion };

// A Timeline central pedida originalmente (Fase 13): todos os módulos
// (Alimentação, Sono, Brincadeiras, e o que já era criado via /ops —
// Rotina, Desenvolvimento, Passeio, Observação) numa única lista
// cronológica, um dia por vez, com filtro, e cada linha registrada
// levando ao detalhe/edição/exclusão (src/app/quintal/timeline/[id]/
// page.tsx). Objetivo de UX explícito do pedido: parecer que "o Quintal
// está acompanhando o dia", não um sistema de registro — por isso nada
// de tabela densa, cada linha é um ícone, horário e no máximo duas
// linhas de detalhe.
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
        <PageHeader title="Timeline" />
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

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const viewingToday = isSameDay(dayStart, todayStart);
  const viewingFutureDay = !viewingToday && dayStart.getTime() > todayStart.getTime();

  const [allEntries, routine, fullDaySuggestions] = await Promise.all([
    getDayTimeline(activeChild.id, {
      since: dayStart.toISOString(),
      until: dayEnd.toISOString(),
    }),
    // "Resto do dia" só faz sentido pra hoje — routineEngine projeta
    // sempre a partir do agora real (ver isSameDay acima).
    viewingToday ? getRoutineSuggestions(activeChild.id) : null,
    // De amanhã em diante: uma proposta do dia inteiro (pedido explícito
    // desta fase), não um resto-do-dia a partir de agora.
    viewingFutureDay ? getFullDayRoutine(activeChild.id, dayStart) : null,
  ]);

  const entries = filter
    ? allEntries.filter((entry) => (TIMELINE_FILTER_TYPES[filter] as string[]).includes(entry.type))
    : allEntries;

  const rawSuggestions = routine?.suggestions ?? fullDaySuggestions ?? [];
  const suggestions = rawSuggestions.filter(
    (suggestion) => !filter || SUGGESTION_KIND_TO_FILTER[suggestion.kind] === filter,
  );

  const agenda: AgendaRow[] = [
    ...entries.map((entry): AgendaRow => ({ kind: "registered", sortAt: entry.sortAt, entry })),
    ...suggestions.map((suggestion): AgendaRow => ({ kind: "suggested", sortAt: suggestion.suggestedAt, suggestion })),
  ].sort((a, b) => a.sortAt.localeCompare(b.sortAt));

  const prevDayParam = toDayParam(addDays(dayStart, -1));
  const nextDayParam = toDayParam(addDays(dayStart, 1));
  const filterQuery = filter ? `&filtro=${filter}` : "";

  return (
    <PageContainer space={6}>
      <PageHeader title="Timeline" />

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

      {(viewingToday || viewingFutureDay) && suggestions.length > 0 && (
        <p className="text-xs text-ink-muted">
          {viewingToday
            ? "Os cards mais claros são possibilidades para o resto do dia — não um compromisso."
            : "Os cards mais claros são uma proposta de como o dia pode ser — não um compromisso."}
        </p>
      )}

      {agenda.length === 0 ? (
        filter ? (
          <p className={cardClassName("p-4 text-sm text-ink-muted")}>Nada por aqui nesse filtro, nesse dia.</p>
        ) : (
          <div className={cardClassName("space-y-1 p-4 text-sm text-ink-muted")}>
            <p>Nada registrado ainda nesse dia — o dia da família aparece aqui assim que algo for registrado.</p>
            <Link href="/quintal/chat" className="font-medium text-ink underline underline-offset-2">
              Conte pro Quintal como foi esse dia
            </Link>
          </div>
        )
      ) : (
        <ol className="space-y-2">
          {agenda.map((row) => {
            if (row.kind === "registered") {
              const entry = row.entry;
              return (
                <li key={entry.displayKey}>
                  <Link
                    href={`/quintal/timeline/${entry.id}`}
                    className={cardClassName("flex items-start gap-3 p-3 transition-all duration-200 hover:shadow-[var(--shadow-lift)]")}
                  >
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
                      <p className="pt-0.5 text-[11px] text-ink-muted">{eventOriginLabels[entry.origin]}</p>
                    </div>
                  </Link>
                </li>
              );
            }

            const suggestion = row.suggestion;
            const icon = ROUTINE_SUGGESTION_ICONS[suggestion.kind];
            return (
              <li key={`suggestion-${suggestion.id}`}>
                <Link
                  href={suggestion.href}
                  className={inviteCardClassName(`flex items-start gap-3 p-3 ${cardHoverLift}`)}
                >
                  <QuintalIcon name={icon.name} theme={icon.theme} size="md" background="light" />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-semibold text-ink">{suggestion.label}</p>
                      <span className="shrink-0 font-mono text-xs text-ink-muted">
                        {new Date(suggestion.suggestedAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-ink-muted">{suggestion.reason}</p>
                    <p className="pt-0.5 text-[11px] text-ink-muted">Sugestão</p>
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
