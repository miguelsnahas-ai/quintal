import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionCaregiver } from "@/lib/authorization";
import { getActiveChildContext } from "@/lib/activeChild";
import { getHygieneHistory } from "@/lib/hygiene";
import { groupByDay } from "@/lib/format";
import { cardClassName } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/FilterChips";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { HygieneModuleNav } from "@/components/hygiene/HygieneModuleNav";
import { HygieneEntryCard } from "@/components/hygiene/HygieneEntryCard";

export const metadata: Metadata = {
  title: "Histórico de higiene — Quintal",
  robots: { index: false, follow: false },
};

const FILTERS = [
  { value: "todos", label: "Todos" },
  { value: "pee", label: "Xixi" },
  { value: "poop", label: "Cocô" },
  { value: "both", label: "Os dois" },
] as const;

// Tela 4: histórico completo, agrupado por dia — mesmo padrão de
// groupByDay já usado em Sono/Alimentação ("08:32 · Xixi · Fralda
// normal", formato ilustrativo do pedido desta fase).
export default async function HistoricoHigienePage({
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
    redirect("/quintal/higiene");
  }

  const history = await getHygieneHistory(activeChild.id);
  const filtered = activeFilter === "todos" ? history : history.filter((entry) => entry.diaperResult === activeFilter);
  const groups = groupByDay(filtered, (entry) => entry.occurredAt);

  return (
    <PageContainer>
      <PageHeader title="Histórico de higiene" description={activeChild.name} backHref="/quintal/higiene" backLabel="Higiene" />
      <HygieneModuleNav active="/quintal/higiene/historico" />

      <FilterChips
        activeValue={activeFilter}
        options={FILTERS.map((f) => ({ value: f.value, label: f.label, href: `/quintal/higiene/historico?filtro=${f.value}` }))}
      />

      {groups.length === 0 ? (
        <p className={cardClassName("p-4 text-sm text-ink-muted")}>Nenhuma troca registrada ainda.</p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.label} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{group.label}</h2>
              <div className="space-y-2">
                {group.entries.map((entry) => (
                  <HygieneEntryCard key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
