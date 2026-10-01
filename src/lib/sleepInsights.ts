import { createServiceClient } from "@/lib/supabase/service";
import { sleepEventPayloadSchema } from "@/lib/validation/sleep";
import type { SleepType } from "@/lib/validation/sleep";
import type { Json } from "@/lib/supabase/types";

// ---------------------------------------------------------------------
// Análises de sono (módulo Sono, refatoração desta fase) — tendências
// simples a partir dos mesmos eventos reais que Histórico/Visão geral já
// usam, nunca um diagnóstico. Mesma separação DECISÃO/REDAÇÃO pura vs.
// busca assíncrona já usada em routineEngine.ts: summarizeDailyTotals e
// describeSleepTrend não tocam banco nem relógio de verdade (`now` é
// sempre parâmetro), então são testáveis sem mock nenhum.
// ---------------------------------------------------------------------

export type DaySleepTotals = { date: string; napMinutes: number; nightMinutes: number };

type CompletedSleepEntry = { occurredAt: string; sleepType: SleepType | null; durationMinutes: number | null };

function dateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Um dia por entrada, mesmo sem nenhum registro naquele dia (barras
// vazias contam a mesma história que barras cheias) — por isso itera as
// datas do período, em vez de só agrupar o que existe (groupByDay, em
// format.ts, serve ao Histórico porque ali dias sem registro não
// aparecem mesmo; aqui precisam aparecer, com altura zero).
export function summarizeDailyTotals(entries: CompletedSleepEntry[], days: number, referenceDate: Date): DaySleepTotals[] {
  const byDate = new Map<string, { napMinutes: number; nightMinutes: number }>();

  for (const entry of entries) {
    if (entry.durationMinutes === null || entry.sleepType === null) continue;
    const key = dateKey(new Date(entry.occurredAt));
    const bucket = byDate.get(key) ?? { napMinutes: 0, nightMinutes: 0 };
    if (entry.sleepType === "nap") bucket.napMinutes += entry.durationMinutes;
    else bucket.nightMinutes += entry.durationMinutes;
    byDate.set(key, bucket);
  }

  const result: DaySleepTotals[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const bucket = byDate.get(key) ?? { napMinutes: 0, nightMinutes: 0 };
    result.push({ date: key, ...bucket });
  }
  return result;
}

// Observação sobre consistência, não sobre "o quanto é" — nunca compara
// com nenhuma referência externa/clínica (pedido explícito: "evitar
// linguagem médica", "não apresentar diagnóstico"). Só diz se os
// horários de sono noturno têm ficado parecidos de um dia para o outro
// ou não. Sem registros suficientes (menos de 3 noites completas no
// período), não arrisca nenhuma frase.
export function describeSleepTrend(totals: DaySleepTotals[]): string | null {
  const nights = totals.map((day) => day.nightMinutes).filter((minutes) => minutes > 0);
  if (nights.length < 3) return null;

  const mean = nights.reduce((sum, m) => sum + m, 0) / nights.length;
  if (mean === 0) return null;

  const variance = nights.reduce((sum, m) => sum + (m - mean) ** 2, 0) / nights.length;
  const coefficientOfVariation = Math.sqrt(variance) / mean;

  const periodLabel = `${totals.length} dias`;
  return coefficientOfVariation < 0.15
    ? `Nos últimos ${periodLabel}, o sono noturno ficou relativamente estável.`
    : `Nos últimos ${periodLabel}, os horários de sono noturno variaram mais do que o costume.`;
}

// Visão mensal: 30 barras diárias seriam ilegíveis no mobile ("evitar
// gráficos excessivamente técnicos") — agrupa em blocos de 7 dias
// (rotulados pela data em que cada bloco termina) em vez de reduzir a
// granularidade dos dados reais, só a forma como o gráfico os mostra.
export function bucketIntoWeeks(dailyTotals: DaySleepTotals[]): DaySleepTotals[] {
  const buckets: DaySleepTotals[] = [];
  for (let i = 0; i < dailyTotals.length; i += 7) {
    const slice = dailyTotals.slice(i, i + 7);
    buckets.push({
      date: slice[slice.length - 1].date,
      napMinutes: slice.reduce((sum, d) => sum + d.napMinutes, 0),
      nightMinutes: slice.reduce((sum, d) => sum + d.nightMinutes, 0),
    });
  }
  return buckets;
}

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

// Variação percentual contra o período imediatamente anterior, de
// mesmo tamanho (7 dias vs. os 7 dias antes deles, por exemplo) — a
// única forma de "tendência" que não depende de nenhum valor de
// referência externo, só do histórico da própria família.
function percentChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export type SleepAnalytics = {
  days: number;
  dailyTotals: DaySleepTotals[];
  averageTotalMinutesPerDay: number | null;
  averageNapMinutes: number | null;
  averageNapCountPerDay: number;
  // Média por NOITE com sono noturno registrado (não por dia do
  // calendário — uma noite que atravessa a meia-noite conta no dia em
  // que começou, mesma convenção do Histórico).
  averageNightMinutes: number | null;
  trendPercent: number | null;
  pattern: string | null;
};

// Busca HISTORY_WINDOW = days*2 dias de uma vez (o período pedido +
// igual período anterior, para a comparação de tendência), um único
// SELECT — mesmo tradeoff de "uma consulta mais ampla em vez de duas"
// já usado em getDashboardSummary.
export async function getSleepAnalytics(childId: string, days: 7 | 30): Promise<SleepAnalytics> {
  const supabase = createServiceClient();
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - days * 2);

  const { data } = await supabase
    .from("events")
    .select("occurred_at, duration_minutes, payload")
    .eq("child_id", childId)
    .eq("type", "sleep")
    .gte("occurred_at", since.toISOString())
    .order("occurred_at", { ascending: true });

  const entries: CompletedSleepEntry[] = (data ?? []).map((row: { occurred_at: string; duration_minutes: number | null; payload: Json }) => {
    const parsed = sleepEventPayloadSchema.safeParse(row.payload);
    return {
      occurredAt: row.occurred_at,
      sleepType: parsed.success ? parsed.data.sleepType : null,
      durationMinutes: row.duration_minutes,
    };
  });

  const fullRange = summarizeDailyTotals(entries, days * 2, now);
  const dailyTotals = fullRange.slice(days);
  const previousTotals = fullRange.slice(0, days);

  const napCounts = entries.filter((e) => e.sleepType === "nap" && e.durationMinutes !== null);
  const napMinutesInWindow = napCounts
    .filter((e) => new Date(e.occurredAt).getTime() >= now.getTime() - days * 24 * 60 * 60 * 1000)
    .map((e) => e.durationMinutes as number);

  const currentTotalAvg = average(dailyTotals.map((d) => d.napMinutes + d.nightMinutes));
  const previousTotalAvg = average(previousTotals.map((d) => d.napMinutes + d.nightMinutes));
  const nightsWithSleep = dailyTotals.map((d) => d.nightMinutes).filter((minutes) => minutes > 0);

  return {
    days,
    dailyTotals,
    averageTotalMinutesPerDay: currentTotalAvg,
    averageNapMinutes: average(napMinutesInWindow),
    averageNapCountPerDay: napMinutesInWindow.length / days,
    averageNightMinutes: average(nightsWithSleep),
    trendPercent: percentChange(currentTotalAvg, previousTotalAvg),
    pattern: describeSleepTrend(dailyTotals),
  };
}
