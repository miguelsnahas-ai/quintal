import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TrendingDown, TrendingUp, Sprout } from "lucide-react";
import { getSessionCaregiver } from "@/lib/authorization";
import { getActiveChildContext } from "@/lib/activeChild";
import { getSleepAnalytics, bucketIntoWeeks } from "@/lib/sleepInsights";
import { formatDurationMinutes } from "@/lib/format";
import { cardClassName, inviteCardClassName } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/FilterChips";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SleepModuleNav } from "@/components/sleep/SleepModuleNav";
import { SleepBarChart, shortDateLabel } from "@/components/sleep/SleepBarChart";

export const metadata: Metadata = {
  title: "Análises de sono — Quintal",
  robots: { index: false, follow: false },
};

const PERIODS = [
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" },
  { value: "insights", label: "Insights" },
] as const;
type Period = (typeof PERIODS)[number]["value"];

// Tela 4: tendências simples a partir do mesmo histórico real do
// Histórico/Visão geral — nunca um diagnóstico (ver sleepInsights.ts,
// describeSleepTrend). "Insights" mostra só a leitura em texto, sem
// gráfico — as outras duas mostram o gráfico de barras + os mesmos
// textos abaixo.
export default async function AnalisesSonoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo } = await searchParams;
  const period: Period = PERIODS.some((p) => p.value === periodo) ? (periodo as Period) : "semana";

  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const { active: activeChild } = await getActiveChildContext(session.caregiverId);
  if (!activeChild) {
    redirect("/quintal/sono");
  }

  const days = period === "mes" ? 30 : 7;
  const analytics = await getSleepAnalytics(activeChild.id, days);
  const chartData = period === "mes" ? bucketIntoWeeks(analytics.dailyTotals) : analytics.dailyTotals;
  const hasAnyData = analytics.dailyTotals.some((day) => day.napMinutes + day.nightMinutes > 0);

  const TrendIcon = analytics.trendPercent !== null && analytics.trendPercent < 0 ? TrendingDown : TrendingUp;

  return (
    <PageContainer>
      <PageHeader title="Análises de sono" description={activeChild.name} backHref="/quintal/sono" backLabel="Sono" />
      <SleepModuleNav active="/quintal/sono/analises" />

      <FilterChips
        activeValue={period}
        options={PERIODS.map((p) => ({ value: p.value, label: p.label, href: `/quintal/sono/analises?periodo=${p.value}` }))}
      />

      {!hasAnyData ? (
        <p className={cardClassName("p-4 text-sm text-ink-muted")}>
          Ainda não há sono suficiente registrado para mostrar uma análise. Volte aqui depois de
          alguns dias de registro.
        </p>
      ) : (
        <>
          <div className={cardClassName("space-y-1 p-4")}>
            <p className="text-xs font-medium text-ink-muted">Média de sono diário</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-ink">
                {analytics.averageTotalMinutesPerDay ? formatDurationMinutes(Math.round(analytics.averageTotalMinutesPerDay)) : "—"}
              </p>
              {analytics.trendPercent !== null && (
                <span className="flex items-center gap-1 text-xs font-medium text-ink-muted">
                  <TrendIcon className="h-3.5 w-3.5" aria-hidden />
                  {analytics.trendPercent > 0 ? "+" : ""}
                  {analytics.trendPercent}%
                </span>
              )}
            </div>
            <p className="text-xs text-ink-muted">em relação ao período anterior</p>
          </div>

          {period !== "insights" && (
            <div className={cardClassName("p-4")}>
              <p className="mb-3 text-sm font-medium text-ink">Duração do sono</p>
              <SleepBarChart data={chartData} labelFor={period === "mes" ? shortDateLabel : undefined} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className={cardClassName("space-y-1 p-4 text-center")}>
              <p className="text-xs font-medium text-ink-muted">Média de sonecas</p>
              <p className="text-sm font-semibold text-ink">
                {analytics.averageNapCountPerDay > 0 ? `${Math.round(analytics.averageNapCountPerDay * 10) / 10} por dia` : "—"}
              </p>
            </div>
            <div className={cardClassName("space-y-1 p-4 text-center")}>
              <p className="text-xs font-medium text-ink-muted">Duração média das sonecas</p>
              <p className="text-sm font-semibold text-ink">
                {analytics.averageNapMinutes ? formatDurationMinutes(Math.round(analytics.averageNapMinutes)) : "—"}
              </p>
            </div>
          </div>

          {analytics.pattern && (
            <div className={inviteCardClassName("flex items-start gap-3 p-4")}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tertiary">
                <Sprout className="h-4 w-4 text-ink" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">Padrões observados</p>
                <p className="text-xs text-ink-muted">{analytics.pattern}</p>
              </div>
            </div>
          )}
        </>
      )}

      <p className="text-xs text-ink-muted">
        Essas leituras são só uma forma de acompanhar a rotina — não uma avaliação médica.
        Qualquer dúvida sobre o sono vale uma conversa com o pediatra.
      </p>
    </PageContainer>
  );
}
