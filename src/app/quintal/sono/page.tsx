import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionCaregiver } from "@/lib/authorization";
import { getActiveChildContext } from "@/lib/activeChild";
import { formatDurationMinutes } from "@/lib/format";
import { getOpenSleepSession, getTodaySleepSummary, getSleepHistory } from "@/lib/sleep";
import { getSleepAnalytics } from "@/lib/sleepInsights";
import { cardClassName, inviteCardClassName } from "@/components/ui/Card";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterChips } from "@/components/ui/FilterChips";
import { buttonClassName } from "@/components/ui/Button";
import { PillarIcon } from "@/components/icon/PillarIcon";
import { SleepModuleNav } from "@/components/sleep/SleepModuleNav";
import { SleepRing } from "@/components/sleep/SleepRing";
import { SleepEntryCard } from "@/components/sleep/SleepEntryCard";

export const metadata: Metadata = {
  title: "Sono — Quintal",
  robots: { index: false, follow: false },
};

const PERIODS = [
  { value: "hoje", label: "Hoje" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" },
] as const;
type Period = (typeof PERIODS)[number]["value"];

function isPeriod(value: string | undefined): value is Period {
  return PERIODS.some((p) => p.value === value);
}

// Visão geral (tela 1 do módulo Sono, refatoração desta fase): o anel +
// resumo que a família vê ao abrir o módulo. Registro, Histórico,
// Análises e Orientações viraram telas próprias (SleepModuleNav) — esta
// aqui é só leitura, "o que já sabemos", nunca o formulário.
export default async function SonoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo } = await searchParams;
  const period: Period = isPeriod(periodo) ? periodo : "hoje";

  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const { active: activeChild } = await getActiveChildContext(session.caregiverId);

  if (!activeChild) {
    return (
      <PageContainer space={6}>
        <PageHeader title="Sono" backHref="/quintal/mais" backLabel="Mais" />
        <p className={cardClassName("p-4 text-sm text-ink-muted")}>
          Nenhuma criança cadastrada ainda para esta família.
        </p>
      </PageContainer>
    );
  }

  const [openSession, todaySummary, history] = await Promise.all([
    getOpenSleepSession(activeChild.id),
    getTodaySleepSummary(activeChild.id),
    getSleepHistory(activeChild.id, 1),
  ]);

  // Hoje usa os números de verdade do dia; Semana/Mês usam a média
  // diária do mesmo motor que alimenta Análises — mesma fonte, duas
  // leituras (um instantâneo vs. uma média), nunca dois cálculos
  // diferentes para a mesma coisa.
  let napMinutes = todaySummary.napTotalMinutes;
  let napCount = todaySummary.napCount;
  let nightMinutes = todaySummary.nightTotalMinutes;
  let ringLabel = "de sono hoje";

  if (period !== "hoje") {
    const analytics = await getSleepAnalytics(activeChild.id, period === "semana" ? 7 : 30);
    napMinutes = Math.round((analytics.averageNapMinutes ?? 0) * analytics.averageNapCountPerDay);
    napCount = Math.round(analytics.averageNapCountPerDay * 10) / 10;
    nightMinutes = Math.round(analytics.averageNightMinutes ?? 0);
    ringLabel = "de sono por dia, em média";
  }

  const lastEntry = history[0] ?? null;

  return (
    <PageContainer>
      <PageHeader title="Sono" backHref="/quintal/mais" backLabel="Mais" />
      <SleepModuleNav active="/quintal/sono" />

      <p className="text-xs text-ink-muted">
        Este é um registro simples da rotina de sono — não uma ferramenta médica ou de
        diagnóstico. Mudanças bruscas no sono valem uma conversa com o pediatra.
      </p>

      <FilterChips
        activeValue={period}
        options={PERIODS.map((p) => ({ value: p.value, label: p.label, href: `/quintal/sono?periodo=${p.value}` }))}
      />

      <div className="flex flex-col items-center gap-4 py-2">
        <SleepRing napMinutes={napMinutes} nightMinutes={nightMinutes} label={ringLabel} />
        <div className="grid w-full grid-cols-2 gap-3">
          <div className={cardClassName("space-y-1 p-4 text-center")}>
            <p className="text-xs font-medium text-ink-muted">{period === "hoje" ? "Sonecas" : "Sonecas por dia"}</p>
            <p className="text-sm font-semibold text-ink">
              {napCount > 0 ? `${napCount} · ${formatDurationMinutes(napMinutes)}` : "Nenhuma ainda"}
            </p>
          </div>
          <div className={cardClassName("space-y-1 p-4 text-center")}>
            <p className="text-xs font-medium text-ink-muted">Sono noturno</p>
            <p className="text-sm font-semibold text-ink">
              {nightMinutes > 0 ? formatDurationMinutes(nightMinutes) : "Sem registro ainda"}
            </p>
          </div>
        </div>
      </div>

      {lastEntry && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-ink-muted">Último sono</h2>
          <SleepEntryCard entry={lastEntry} />
        </section>
      )}

      <Link href="/quintal/sono/registrar" className={buttonClassName("primary", "w-full justify-center")}>
        <PillarIcon name="sono" size={18} />
        {openSession ? "Criança dormindo — registrar que acordou" : "Registrar sono"}
      </Link>

      {!lastEntry && (
        <div className={inviteCardClassName("p-4 text-sm text-ink-muted")}>
          Nenhum sono registrado ainda para {activeChild.name}. Assim que começar a registrar, o
          resumo e o histórico aparecem aqui.
        </div>
      )}
    </PageContainer>
  );
}
