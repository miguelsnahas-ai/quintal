import { createServiceClient } from "@/lib/supabase/service";
import { startOfToday } from "@/lib/format";
import { ACTIVITY_EVENT_TYPES } from "@/lib/childContext";

// ---------------------------------------------------------------------
// Chips de pergunta sugerida no chat vazio — pedido explícito: "mais
// estímulos visuais para o usuário interagir com a IA e fazer os
// registros". Determinístico, não um prompt de IA à parte: reaproveita
// o mesmo sinal que já decide o texto-convite dos cards do Resumo do
// dia (src/app/quintal/page.tsx) — o que ainda não foi registrado hoje
// — então as duas telas nunca sugerem coisas diferentes pela mesma
// lacuna. getTodayEventCounts é deliberadamente mais leve que
// getDashboardSummary (dashboard.ts): só a contagem por tipo, sem
// sugestões de atividade/refeição/material, que o chat não precisa pra
// decidir quais chips mostrar.
// ---------------------------------------------------------------------

export type TodayEventCounts = {
  sleepCount: number;
  mealCount: number;
  freePlayCount: number;
  routineCount: number;
};

const GAP_QUESTIONS: { key: keyof TodayEventCounts; question: string }[] = [
  { key: "sleepCount", question: "Como foi o sono hoje?" },
  { key: "mealCount", question: "Como foi a alimentação hoje?" },
  { key: "freePlayCount", question: "Quais brincadeiras fizeram mais sucesso hoje?" },
  { key: "routineCount", question: "Teve algum evento de rotina pra contar?" },
];

// Quando não há nenhuma lacuna (a família já registrou tudo hoje) — ou
// pra completar até MAX_SUGGESTED_QUESTIONS quando há só uma ou duas —
// perguntas abertas genéricas, nunca específicas sobre um dado que não
// sabemos se existe.
const GENERIC_QUESTIONS = [
  "Quer sugestões de brincadeira pra agora?",
  "Tem alguma dúvida sobre a rotina de hoje?",
  "Quer registrar mais alguma coisa sobre o dia?",
];

const MAX_SUGGESTED_QUESTIONS = 3;

// Pura — testável sem banco, mesmo espírito de routineEngine.ts
// (DECISÃO separada de busca de dado real).
export function getSuggestedChatQuestions(counts: TodayEventCounts): string[] {
  const gapQuestions = GAP_QUESTIONS.filter((entry) => counts[entry.key] === 0).map((entry) => entry.question);
  if (gapQuestions.length >= MAX_SUGGESTED_QUESTIONS) {
    return gapQuestions.slice(0, MAX_SUGGESTED_QUESTIONS);
  }
  return [...gapQuestions, ...GENERIC_QUESTIONS].slice(0, MAX_SUGGESTED_QUESTIONS);
}

// Indicador sutil no ícone de Chat da navegação (BottomNav) — pedido
// explícito: "indicadores ativos de navegação" para incentivar o uso do
// chat. Deliberadamente conservador: só acende quando o dia ainda está
// totalmente em branco (nenhuma categoria registrada), nunca por cada
// lacuna isolada — um ponto que você vê uma vez e resolve conversando
// ou registrando, não um contador que fica cutucando o dia inteiro.
export function hasNoRegistrationsToday(counts: TodayEventCounts): boolean {
  return (
    counts.sleepCount === 0 && counts.mealCount === 0 && counts.freePlayCount === 0 && counts.routineCount === 0
  );
}

export async function getTodayEventCounts(childId: string): Promise<TodayEventCounts> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("events")
    .select("type")
    .eq("child_id", childId)
    .in("type", ACTIVITY_EVENT_TYPES)
    .gte("occurred_at", startOfToday());

  const counts: TodayEventCounts = { sleepCount: 0, mealCount: 0, freePlayCount: 0, routineCount: 0 };
  for (const row of data ?? []) {
    if (row.type === "sleep") counts.sleepCount += 1;
    else if (row.type === "meal") counts.mealCount += 1;
    else if (row.type === "free_play") counts.freePlayCount += 1;
    else if (row.type === "routine") counts.routineCount += 1;
  }
  return counts;
}
