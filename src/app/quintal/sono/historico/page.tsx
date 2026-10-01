import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionCaregiver } from "@/lib/authorization";
import { getActiveChildContext } from "@/lib/activeChild";
import { getSleepHistory } from "@/lib/sleep";
import { groupByDay, formatDurationMinutes } from "@/lib/format";
import { cardClassName } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/FilterChips";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SleepModuleNav } from "@/components/sleep/SleepModuleNav";
import { SleepEntryCard } from "@/components/sleep/SleepEntryCard";

export const metadata: Metadata = {
  title: "Histórico de sono — Quintal",
  robots: { index: false, follow: false },
};

const FILTERS = [
  { value: "todos", label: "Todos" },
  { value: "nap", label: "Sonecas" },
  { value: "night", label: "Noite" },
] as const;

// Tela 3: histórico completo, agrupado por dia (mesma convenção já
// documentada em sleep.ts — um período que atravessa a meia-noite
// aparece inteiro no dia em que começou). O total do dia, ao lado do
// rótulo, é a soma real das durações do grupo.
export default async function HistoricoSonoPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { filtro } = await searchParams;
  const activeFilter = FILTERS.some((f) => f.value === filtro) ? (filtro as (typeof FILTERS)[number]["value"]) : "todos";

  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const { active: activeChild } = await getActiveChildContext(session.caregiverId);
  if (!activeChild) {
    redirect("/quintal/sono");
  }

  const history = await getSleepHistory(activeChild.id);
  const filtered = activeFilter === "todos" ? history : history.filter((entry) => entry.sleepType === activeFilter);
  const groups = groupByDay(filtered, (entry) => entry.startedAt);

  return (
    <PageContainer>
      <PageHeader title="Histórico de sono" description={activeChild.name} backHref="/quintal/sono" backLabel="Sono" />
      <SleepModuleNav active="/quintal/sono/historico" />

      <FilterChips
        activeValue={activeFilter}
        options={FILTERS.map((f) => ({ value: f.value, label: f.label, href: `/quintal/sono/historico?filtro=${f.value}` }))}
      />

      {groups.length === 0 ? (
        <p className={cardClassName("p-4 text-sm text-ink-muted")}>Nenhum sono registrado ainda.</p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const dayTotal = group.entries.reduce((sum, entry) => sum + (entry.durationMinutes ?? 0), 0);
            return (
              <div key={group.label} className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{group.label}</h2>
                  {dayTotal > 0 && <span className="text-xs font-medium text-ink-muted">{formatDurationMinutes(dayTotal)}</span>}
                </div>
                <div className="space-y-2">
                  {group.entries.map((entry) => (
                    <SleepEntryCard key={entry.id} entry={entry} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-ink-muted">Períodos que atravessam a meia-noite aparecem inteiros no dia em que começaram.</p>
    </PageContainer>
  );
}
