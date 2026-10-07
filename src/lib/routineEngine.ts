import { createServiceClient } from "@/lib/supabase/service";
import { ageInMonths } from "@/lib/format";
import { getActivity, toActivitySummary, type ActivitySummary } from "@/lib/activity";
import { getOpenSleepSession, getSleepHistory, type SleepHistoryEntry } from "@/lib/sleep";
import type { SleepType } from "@/lib/validation/sleep";
import { formatDurationMinutes } from "@/lib/format";
import { getMealHistory, type MealHistoryEntry } from "@/lib/feeding";
import {
  getActivityHistory,
  getActivitySuggestions,
  getRecentNegativeLibraryFeedbackActivityIds,
  type ActivityHistoryEntry,
} from "@/lib/play";
import { mealSlots, mealSlotLabels, type MealSlot } from "@/lib/validation/feeding";

// ---------------------------------------------------------------------
// Camada de rotina adaptativa (Fase 14) — NÃO uma agenda: uma sequência
// curta de sugestões para o resto do dia, recalculada a cada visita a
// partir do que já foi registrado (sono, refeições, atividades). Regras
// simples, explícitas e testáveis (ver routineEngine.test.ts) — nenhum
// agente autônomo, nenhuma IA, nenhuma tabela nova. Ver
// docs/ARCHITECTURE_TARGET.md, "Rotina adaptativa (Fase 14)".
//
// Duas camadas deliberadamente separadas, mesmo espírito
// DECISÃO/REDAÇÃO de recommendation.ts (Fase 5):
//   - detectState / computeTypical*Time / buildRoutineSuggestions são
//     puras (sem banco, sem relógio de verdade escondido — `now` é
//     sempre um parâmetro) e cobertas por teste automatizado.
//   - getRoutineSuggestions é a única função assíncrona, só busca dado
//     real e chama as puras acima — nada de regra vive aqui.
// ---------------------------------------------------------------------

const HISTORY_LOOKBACK_LIMIT = 30;

// Uma soneca abaixo disso conta como "curta" para a regra de adaptação
// ("priorizar atividades mais tranquilas"). Não é um limiar clínico —
// só o suficiente para distinguir "descansou pouco" de "descansou bem"
// nesta regra específica.
const SHORT_NAP_THRESHOLD_MINUTES = 30;

export type RoutineState = {
  isNapping: boolean;
  // Minutos desde o fim do último sono conhecido — null quando não há
  // sono concluído nenhum no histórico recente (nunca inventa um valor).
  minutesAwake: number | null;
  // Minutos desde a última refeição registrada — null sem histórico.
  minutesSinceLastMeal: number | null;
  // "Se a soneca foi muito curta" (pedido explícito da Fase 14).
  lastNapWasShort: boolean;
  // "Se uma atividade foi registrada como favorita" — a mais recente
  // com feedback 'loved' no histórico de Brincadeiras (Fase 11).
  favoriteActivity: { id: string; title: string } | null;
  // Tipo do último sono concluído (null sem histórico) — usado pela Home
  // (Fase "Momento atual") pra dizer "Soneca terminou" vs. "Acordou",
  // em vez de genericamente "o sono terminou".
  lastSleepType: SleepType | null;
};

export type RoutineInputs = {
  now: Date;
  openSleepSession: { startedAt: string } | null;
  // Mais recentes primeiro — mesma ordenação que getSleepHistory/
  // getMealHistory/getActivityHistory já devolvem.
  sleepHistory: SleepHistoryEntry[];
  mealHistory: MealHistoryEntry[];
  activityHistory: ActivityHistoryEntry[];
};

// Réplica exata do "estado atual da criança" a partir do que já foi
// registrado — nenhuma suposição, nenhum valor inventado quando o dado
// não existe.
export function detectState(input: RoutineInputs): RoutineState {
  const isNapping = input.openSleepSession !== null;

  const lastCompletedSleep = input.sleepHistory.find((entry) => entry.endedAt !== null);
  const minutesAwake =
    !isNapping && lastCompletedSleep?.endedAt
      ? minutesBetween(new Date(lastCompletedSleep.endedAt), input.now)
      : null;

  const lastNapWasShort = Boolean(
    lastCompletedSleep &&
      lastCompletedSleep.sleepType === "nap" &&
      lastCompletedSleep.durationMinutes !== null &&
      lastCompletedSleep.durationMinutes < SHORT_NAP_THRESHOLD_MINUTES,
  );

  const lastMeal = input.mealHistory[0] ?? null;
  const minutesSinceLastMeal = lastMeal ? minutesBetween(new Date(lastMeal.occurredAt), input.now) : null;

  const lovedEntry = input.activityHistory.find((entry) => entry.feedback === "loved" && entry.activityId);
  const favoriteActivity = lovedEntry
    ? { id: lovedEntry.activityId as string, title: lovedEntry.activityTitle ?? "Atividade favorita" }
    : null;

  return {
    isNapping,
    minutesAwake,
    minutesSinceLastMeal,
    lastNapWasShort,
    favoriteActivity,
    lastSleepType: lastCompletedSleep?.sleepType ?? null,
  };
}

// "Momento atual" (Home, refatoração desta fase) — uma única frase sobre
// o agora, não um resumo do dia (isso é o card de Sono/Alimentação/
// Brincadeiras logo abaixo). Prioridade: dormindo agora > acordou/
// terminou a soneca há pouco > a próxima sugestão de rotina, se estiver
// perto o bastante pra valer a pena mencionar. Sem dado suficiente para
// nenhum dos três, não mostra nada — nunca inventa "hora provável de X"
// sem uma rotina histórica real por trás (ver computeTypicalMealTimes).
export type CurrentMoment = { text: string; detail?: string };

const RECENT_WAKE_WINDOW_MINUTES = 90;
const UPCOMING_SOON_WINDOW_MINUTES = 90;

function timeOfDayLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function describeCurrentMoment(
  state: RoutineState,
  openSleepSession: { startedAt: string } | null,
  upcomingMoments: RoutineSuggestion[],
  now: Date,
): CurrentMoment | null {
  if (state.isNapping && openSleepSession) {
    return { text: `Dormindo desde ${timeOfDayLabel(openSleepSession.startedAt)}` };
  }

  if (state.minutesAwake !== null && state.minutesAwake >= 0 && state.minutesAwake <= RECENT_WAKE_WINDOW_MINUTES) {
    const label = state.lastSleepType === "nap" ? "Soneca terminou" : "Acordou";
    return { text: `${label} há ${formatDurationMinutes(state.minutesAwake)}` };
  }

  const next = upcomingMoments[0];
  if (next) {
    const minutesUntil = Math.round((new Date(next.suggestedAt).getTime() - now.getTime()) / 60000);
    if (minutesUntil >= 0 && minutesUntil <= UPCOMING_SOON_WINDOW_MINUTES) {
      return { text: `Hora provável: ${next.label.toLowerCase()}`, detail: next.reason };
    }
  }

  return null;
}

export type RoutineSuggestionKind = "play" | "outing" | "meal" | "wind_down";

export type RoutineSuggestion = {
  id: string;
  kind: RoutineSuggestionKind;
  label: string;
  suggestedAt: string; // ISO
  reason: string;
  href: string;
};

// Espaçamentos entre sugestões — constantes simples, documentadas,
// fáceis de ajustar (pedido explícito: "regras... fáceis de
// modificar"). Nenhuma tem base clínica; são só um ritmo razoável de
// tarde comum, existindo para dar estrutura a "o que vem a seguir", não
// para prescrever quando algo "deve" acontecer.
const PLAY_OFFSET_MINUTES = 20;
const OUTING_OFFSET_AFTER_PLAY_MINUTES = 90;
const MEAL_MIN_GAP_MINUTES = 120; // "se acabou de comer, não sugerir outra refeição já"
const WIND_DOWN_LEAD_MINUTES = 45; // antecedência sugerida antes do horário costumeiro de dormir

// Palavras-chave usadas como "interesses" para inclinar a escolha de
// atividade para algo mais calmo depois de uma soneca curta — reaproveita
// o próprio desempate por interesses de getActivitySuggestions (Fase 11)
// em vez de inventar um novo filtro de "intensidade".
const CALM_ACTIVITY_KEYWORDS = ["calmo", "tranquilo", "aconchego", "sensorial", "relaxante"];

function minutesBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 60000);
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function atMinutesOfDay(reference: Date, minutesFromMidnight: number): Date {
  const result = new Date(reference);
  result.setHours(0, 0, 0, 0);
  result.setMinutes(minutesFromMidnight);
  return result;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

// "Rotina histórica" (Fase 14): o horário mediano de cada refeição nos
// últimos registros, em vez de um horário fixo — duas famílias
// diferentes podem ter um "almoço típico" bem diferente. Simplificação
// assumida: não trata horários que cruzam a meia-noite (irrelevante
// para refeições, relevante só para sono — ver computeTypicalBedtimeMinutes).
export function computeTypicalMealTimes(mealHistory: MealHistoryEntry[]): Partial<Record<MealSlot, number>> {
  const bySlot = new Map<MealSlot, number[]>();
  for (const entry of mealHistory) {
    const list = bySlot.get(entry.slot) ?? [];
    list.push(minutesOfDay(new Date(entry.occurredAt)));
    bySlot.set(entry.slot, list);
  }

  const result: Partial<Record<MealSlot, number>> = {};
  for (const slot of mealSlots) {
    const times = bySlot.get(slot);
    const typical = times ? median(times) : null;
    if (typical !== null) result[slot] = typical;
  }
  return result;
}

// Mesma ideia para o horário costumeiro de início do sono noturno —
// só sono noturno conta (uma soneca não diz nada sobre "hora de
// dormir"). Simplificação assumida: mediana de minutos-desde-meia-noite
// pressupõe que os horários não se espalham pelos dois lados da
// meia-noite (razoável para bedtime, que raramente varia tanto).
export function computeTypicalBedtimeMinutes(sleepHistory: SleepHistoryEntry[]): number | null {
  const nightStarts = sleepHistory
    .filter((entry) => entry.sleepType === "night")
    .map((entry) => minutesOfDay(new Date(entry.startedAt)));
  return median(nightStarts);
}

function nextMealSuggestion(
  now: Date,
  minutesSinceLastMeal: number | null,
  typicalMealTimes: Partial<Record<MealSlot, number>>,
): { slot: MealSlot; at: Date; pushedOut: boolean } | null {
  const nowMinutes = minutesOfDay(now);

  const upcoming = mealSlots
    .map((slot) => ({ slot, minutes: typicalMealTimes[slot] }))
    .filter((candidate): candidate is { slot: MealSlot; minutes: number } => candidate.minutes !== undefined)
    .filter((candidate) => candidate.minutes > nowMinutes)
    .sort((a, b) => a.minutes - b.minutes);

  const next = upcoming[0];
  if (!next) return null;

  let at = atMinutesOfDay(now, next.minutes);
  let pushedOut = false;

  // "Se a criança acabou de comer: não sugerir imediatamente outra
  // refeição" — empurra para depois do intervalo mínimo em vez de
  // simplesmente omitir a sugestão, então a família ainda sabe o que
  // vem a seguir.
  if (minutesSinceLastMeal !== null && minutesSinceLastMeal < MEAL_MIN_GAP_MINUTES) {
    const earliest = new Date(now.getTime() + (MEAL_MIN_GAP_MINUTES - minutesSinceLastMeal) * 60000);
    if (earliest.getTime() > at.getTime()) {
      at = earliest;
      pushedOut = true;
    }
  }

  return { slot: next.slot, at, pushedOut };
}

export type BuildSuggestionsInput = {
  now: Date;
  typicalMealTimes: Partial<Record<MealSlot, number>>;
  typicalBedtimeMinutes: number | null;
  // Já resolvida fora (getRoutineSuggestions) — pode ser a atividade
  // favorita da criança, ou uma sugestão genérica filtrada por idade/
  // calma. null quando não há nenhuma atividade adequada para sugerir.
  playSuggestion: (ActivitySummary & { isFavorite?: boolean }) | null;
};

// A REDAÇÃO desta fase — monta a sequência ordenada a partir do estado
// já decidido e do dado histórico já resumido. Nunca lê banco, nunca
// usa `new Date()` por conta própria (sempre `input.now`) — é o que
// permite testar com um relógio fixo.
export function buildRoutineSuggestions(state: RoutineState, input: BuildSuggestionsInput): RoutineSuggestion[] {
  // Dormindo agora — não há como saber quando vai acordar, então não há
  // nenhum horário concreto pra sugerir ainda (nunca inventa uma hora de
  // despertar).
  if (state.isNapping) return [];

  const suggestions: RoutineSuggestion[] = [];

  if (input.playSuggestion) {
    const playAt = new Date(input.now.getTime() + PLAY_OFFSET_MINUTES * 60000);
    suggestions.push({
      id: "play",
      kind: "play",
      label: `Brincadeira: ${input.playSuggestion.title}`,
      suggestedAt: playAt.toISOString(),
      reason: input.playSuggestion.isFavorite
        ? "Essa atividade já foi um sucesso antes"
        : state.lastNapWasShort
          ? "A última soneca foi curta — algo mais tranquilo agora pode ajudar"
          : "Um momento de brincadeira livre",
      href: "/quintal/brincadeiras",
    });
  }

  const outingAt = new Date(input.now.getTime() + (PLAY_OFFSET_MINUTES + OUTING_OFFSET_AFTER_PLAY_MINUTES) * 60000);
  suggestions.push({
    id: "outing",
    kind: "outing",
    label: "Passeio",
    suggestedAt: outingAt.toISOString(),
    reason: "Uma pausa ao ar livre pode variar o ritmo do dia",
    href: "/quintal/brincadeiras?ambiente=outdoor",
  });

  const meal = nextMealSuggestion(input.now, state.minutesSinceLastMeal, input.typicalMealTimes);
  if (meal) {
    suggestions.push({
      id: "meal",
      kind: "meal",
      label: mealSlotLabels[meal.slot],
      suggestedAt: meal.at.toISOString(),
      reason: meal.pushedOut
        ? "Ainda não faz muito tempo desde a última refeição — um horário um pouco mais tarde"
        : "Baseado no horário que a família costuma seguir",
      href: `/quintal/alimentacao?slot=${meal.slot}`,
    });
  }

  if (input.typicalBedtimeMinutes !== null) {
    const windDownAt = atMinutesOfDay(input.now, input.typicalBedtimeMinutes - WIND_DOWN_LEAD_MINUTES);
    if (windDownAt.getTime() > input.now.getTime()) {
      suggestions.push({
        id: "wind_down",
        kind: "wind_down",
        label: "Preparação para dormir",
        suggestedAt: windDownAt.toISOString(),
        reason: "Baseado no horário em que a família costuma dormir",
        href: "/quintal/sono",
      });
    }
  }

  return suggestions.sort((a, b) => a.suggestedAt.localeCompare(b.suggestedAt));
}

// O único ponto assíncrono do módulo — busca o real, delega toda
// decisão para as funções puras acima.
export async function getRoutineSuggestions(childId: string): Promise<{
  state: RoutineState;
  suggestions: RoutineSuggestion[];
}> {
  const now = new Date();
  const supabase = createServiceClient();

  const [openSleepSession, sleepHistory, mealHistory, activityHistory, childRow, avoidIds] = await Promise.all([
    getOpenSleepSession(childId),
    getSleepHistory(childId, HISTORY_LOOKBACK_LIMIT),
    getMealHistory(childId, HISTORY_LOOKBACK_LIMIT),
    getActivityHistory(childId, HISTORY_LOOKBACK_LIMIT),
    supabase.from("children").select("birth_date, interests").eq("id", childId).maybeSingle(),
    getRecentNegativeLibraryFeedbackActivityIds(childId),
  ]);

  const state = detectState({ now, openSleepSession, sleepHistory, mealHistory, activityHistory });

  let playSuggestion: (ActivitySummary & { isFavorite?: boolean }) | null = null;
  if (!state.isNapping) {
    // "Se uma atividade foi registrada como favorita: considerar
    // novamente" — mas nunca insistir numa que a família marcou como
    // não-interessante/não-feita desde então.
    if (state.favoriteActivity && !avoidIds.has(state.favoriteActivity.id)) {
      const favorite = await getActivity(state.favoriteActivity.id);
      if (favorite) {
        playSuggestion = { ...toActivitySummary(favorite), isFavorite: true };
      }
    }

    if (!playSuggestion) {
      const ageMonths = ageInMonths(childRow.data?.birth_date ?? null);
      const interests = state.lastNapWasShort ? CALM_ACTIVITY_KEYWORDS : childRow.data?.interests ?? [];
      const picks = await getActivitySuggestions({ ageMonths, interests, excludeIds: avoidIds }, 1);
      playSuggestion = picks[0] ?? null;
    }
  }

  const suggestions = buildRoutineSuggestions(state, {
    now,
    typicalMealTimes: computeTypicalMealTimes(mealHistory),
    typicalBedtimeMinutes: computeTypicalBedtimeMinutes(sleepHistory),
    playSuggestion,
  });

  return { state, suggestions };
}
