import { createServiceClient } from "@/lib/supabase/service";
import { startOfToday, ageInMonths } from "@/lib/format";
import { ACTIVITY_EVENT_TYPES } from "@/lib/childContext";
import { getActivity, toActivitySummary, type Activity, type ActivitySummary } from "@/lib/activity";
import { getOpenSleepSession, type OpenSleepSession } from "@/lib/sleep";
import { getActivitySuggestions, getRecentNegativeLibraryFeedbackActivityIds } from "@/lib/play";
import { sleepEventPayloadSchema } from "@/lib/validation/sleep";
import type { EventType } from "@/lib/validation/events";
import type { Json } from "@/lib/supabase/types";

// How many of today's recommendations to surface in the "Para hoje" card
// — a dashboard summary, not the full history (that lives in
// /ops/children/[id] for the Concierge).
const RECOMMENDATIONS_TODAY_LIMIT = 3;

// Generous but bounded — a real day's worth of sleep/routine/free_play/
// development logs won't come close to this, same reasoning as
// ChildContext's own limits (src/lib/childContext.ts).
const TIMELINE_LIMIT = 30;

export type DashboardEvent = {
  id: string;
  type: EventType;
  notes: string;
  occurredAt: string;
  // Only meaningful for 'sleep' (Fase 10) — null for every other type
  // and for a sleep period still in progress. Carried here (not just in
  // the dedicated nap fields below) so Timeline/other consumers of the
  // raw timeline array have it available without a second query.
  durationMinutes: number | null;
  payload: Json;
};

export type DashboardSummary = {
  // Today's counts, split the same way the events table itself already
  // splits day-to-day activity — no new taxonomy invented for the
  // dashboard. mealCount became real data in the Fase 8 structured
  // context layer (the "meal" event type didn't exist when this
  // dashboard first shipped in Fase 7 — its Alimentação card was an
  // honest permanent empty state until then).
  sleepCount: number;
  mealCount: number;
  freePlayCount: number;
  routineCount: number;
  lastRoutine: DashboardEvent | null;
  // Fase 9: mesmo padrão de lastRoutine — o card de Alimentação passa a
  // poder mostrar o que foi a última refeição, não só a contagem.
  lastMeal: DashboardEvent | null;
  // Fase 10: sleepCount acima já contava qualquer evento 'sleep' de hoje
  // (inclusive registros antigos sem payload estruturado); estes dois só
  // contam sonecas (não sono noturno) com payload.sleepType = 'nap' e
  // duração conhecida — o que o card de Sono precisa mostrar
  // ("2 sonecas · 1h35").
  napCountToday: number;
  napTotalMinutesToday: number;
  // Um sono noturno pode ter começado ontem e ainda estar em andamento —
  // por isso não vem do filtro "hoje" acima, ver getOpenSleepSession.
  openSleepSession: OpenSleepSession | null;
  // Fase 11: mesmo padrão de lastMeal — o card de Brincadeiras passa a
  // poder mostrar qual foi a última atividade, não só a contagem.
  lastActivity: DashboardEvent | null;
  // Today's events across the same types ChildContext treats as
  // "day-to-day activity", oldest first — the timeline reads
  // chronologically top to bottom.
  timeline: DashboardEvent[];
  recommendationsToday: ActivitySummary[];
  // Fase 11: um fallback determinístico (idade + interesses, sem IA)
  // quando não há recomendação do chat hoje — "Adicionar uma sugestão de
  // brincadeira" ao Dashboard não devia depender de a família ter
  // conversado; a página decide se mostra isto ou recommendationsToday.
  playSuggestion: ActivitySummary | null;
};

// The Dashboard's single data source — every number and card on
// /quintal comes from here, so the page component itself stays a thin
// render of real data, same split of concerns as getChildContext for the
// chat. Always uses the service client: like activity.ts/recommendation.ts,
// this only ever runs from the family-session-based /quintal route, which
// has no Supabase Auth session of its own to scope RLS against.
export async function getDashboardSummary(childId: string): Promise<DashboardSummary> {
  const supabase = createServiceClient();
  const since = startOfToday();

  const [{ data: todaysEventsRaw }, { data: recommendationsRaw }, openSleepSession, { data: childRow }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, type, notes, occurred_at, duration_minutes, payload")
        .eq("child_id", childId)
        .in("type", ACTIVITY_EVENT_TYPES)
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: true })
        .limit(TIMELINE_LIMIT),
      supabase
        .from("activity_recommendations")
        .select("activity_id, created_at")
        .eq("child_id", childId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(RECOMMENDATIONS_TODAY_LIMIT),
      getOpenSleepSession(childId),
      supabase.from("children").select("birth_date, interests").eq("id", childId).maybeSingle(),
    ]);

  const timeline: DashboardEvent[] = (todaysEventsRaw ?? []).map((event) => ({
    id: event.id,
    type: event.type as EventType,
    notes: event.notes,
    occurredAt: event.occurred_at,
    durationMinutes: event.duration_minutes,
    payload: event.payload,
  }));

  const routineEvents = timeline.filter((event) => event.type === "routine");
  const mealEvents = timeline.filter((event) => event.type === "meal");
  const freePlayEvents = timeline.filter((event) => event.type === "free_play");
  const naps = timeline.filter((event) => {
    if (event.type !== "sleep" || event.durationMinutes === null) return false;
    const parsed = sleepEventPayloadSchema.safeParse(event.payload);
    return parsed.success && parsed.data.sleepType === "nap";
  });

  // getActivity re-fetches each one (same small-N tradeoff already made
  // in recommendation.ts's decideActivity) — at most
  // RECOMMENDATIONS_TODAY_LIMIT calls, not worth a new joined query shape
  // for three rows.
  const recommendedActivities = (
    await Promise.all((recommendationsRaw ?? []).map((row) => getActivity(row.activity_id)))
  ).filter((activity): activity is Activity => activity !== null);

  // Deterministic fallback suggestion (age + interests, same filters the
  // Brincadeiras library uses) — computed unconditionally rather than
  // only when recommendationsToday is empty, so the page (not this
  // function) decides which one to show; the extra query is cheap and
  // bounded, same tradeoff as the getActivity re-fetches above.
  const avoidIds = await getRecentNegativeLibraryFeedbackActivityIds(childId);
  const playSuggestions = await getActivitySuggestions(
    {
      ageMonths: ageInMonths(childRow?.birth_date ?? null),
      interests: childRow?.interests ?? [],
      excludeIds: avoidIds,
    },
    1,
  );

  return {
    sleepCount: timeline.filter((event) => event.type === "sleep").length,
    mealCount: timeline.filter((event) => event.type === "meal").length,
    freePlayCount: freePlayEvents.length,
    routineCount: routineEvents.length,
    lastRoutine: routineEvents[routineEvents.length - 1] ?? null,
    lastMeal: mealEvents[mealEvents.length - 1] ?? null,
    napCountToday: naps.length,
    napTotalMinutesToday: naps.reduce((sum, event) => sum + (event.durationMinutes ?? 0), 0),
    openSleepSession,
    lastActivity: freePlayEvents[freePlayEvents.length - 1] ?? null,
    timeline,
    recommendationsToday: recommendedActivities.map(toActivitySummary),
    playSuggestion: playSuggestions[0] ?? null,
  };
}
