import type { DiaperCondition } from "@/lib/validation/hygiene";

// ---------------------------------------------------------------------
// "Quintal percebeu..." — estrutura para insights, não interpretação
// médica (pedido explícito desta fase). Mesma separação DECISÃO/REDAÇÃO
// pura vs. busca assíncrona de routineEngine.ts/sleepInsights.ts: estas
// funções não tocam banco nem relógio de verdade (`referenceDate` é
// sempre parâmetro), testáveis sem mock.
//
// Regra: só contagens de fatos já registrados ("3 vazamentos nos
// últimos 7 dias"), nunca uma conclusão sobre causa ("a fralda está
// pequena") — isso exigiria contexto que o produto ainda não tem
// (tamanho vs. peso, frequência esperada por idade etc.) e foi
// explicitamente pedido para NÃO fazer nesta fase.
// ---------------------------------------------------------------------

export type HygieneInsightEntry = { occurredAt: string; condition: DiaperCondition };

function entriesInWindow(entries: HygieneInsightEntry[], days: number, referenceDate: Date): HygieneInsightEntry[] {
  const since = new Date(referenceDate);
  since.setDate(since.getDate() - days);
  return entries.filter((entry) => {
    const at = new Date(entry.occurredAt).getTime();
    return at >= since.getTime() && at <= referenceDate.getTime();
  });
}

// Único insight desta primeira versão: contagem de vazamentos. Null
// quando não há nenhum no período — nunca "0 vazamentos" como frase
// (ruído, não informação).
export function describeLeakInsight(entries: HygieneInsightEntry[], days: number, referenceDate: Date): string | null {
  const leaks = entriesInWindow(entries, days, referenceDate).filter((entry) => entry.condition === "leaked");
  if (leaks.length === 0) return null;

  const count = leaks.length;
  return `${count} ${count === 1 ? "vazamento foi registrado" : "vazamentos foram registrados"} nos últimos ${days} dias.`;
}

// Array (não uma string só) de propósito — a "estrutura para
// futuramente suportar" mais regras (ex.: frequência de pele
// irritada) sem mudar a forma como os chamadores consomem isto, só
// adicionar outra função describeXInsight aqui dentro.
export function getHygieneInsightMessages(entries: HygieneInsightEntry[], days: number, referenceDate: Date): string[] {
  return [describeLeakInsight(entries, days, referenceDate)].filter((message): message is string => message !== null);
}
