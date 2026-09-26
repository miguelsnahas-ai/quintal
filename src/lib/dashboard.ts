import { createServiceClient } from "@/lib/supabase/service";
import { ACTIVITY_EVENT_TYPES } from "@/lib/childContext";
import { getActivity, toActivitySummary, type Activity, type ActivitySummary } from "@/lib/activity";
import type { EventType } from "@/lib/validation/events";

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
};

export type DashboardSummary = {
  // Today's counts, split the same way the events table itself already
  // splits day-to-day activity — no new taxonomy invented for the
  // dashboard. "Alimentação" isn't listed here on purpose: there is no
  // feeding event type in the schema yet (see eventTypes in
  // src/lib/validation/events.ts), so it has nothing real to count —
  // the dashboard shows it as an honest empty state instead of
  // fabricating a number.
  sleepCount: number;
  freePlayCount: number;
  routineCount: number;
  lastRoutine: DashboardEvent | null;
  // Today's events across the same types ChildContext treats as
  // "day-to-day activity", oldest first — the timeline reads
  // chronologically top to bottom.
  timeline: DashboardEvent[];
  recommendationsToday: ActivitySummary[];
};

// Midnight in the server's local time zone — same pragmatic MVP
// assumption already documented in src/lib/format.ts
// (toDatetimeLocalValue): no per-family time zone handling exists yet
// anywhere in the codebase, so "hoje" here means the same thing it means
// everywhere else in the app today.
function startOfToday(): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

// The Dashboard's single data source — every number and card on
// /quintal comes from here, so the page component itself stays a thin
// render of real data, same split of concerns as getChildContext for the
// chat. Always uses the service client: like activity.ts/recommendation.ts,
// this only ever runs from the family-session-based /quintal route, which
// has no Supabase Auth session of its own to scope RLS against.
export async function getDashboardSummary(childId: string): Promise<DashboardSummary> {
  const supabase = createServiceClient();
  const since = startOfToday();

  const [{ data: todaysEventsRaw }, { data: recommendationsRaw }] = await Promise.all([
    supabase
      .from("events")
      .select("id, type, notes, occurred_at")
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
  ]);

  const timeline: DashboardEvent[] = (todaysEventsRaw ?? []).map((event) => ({
    id: event.id,
    type: event.type as EventType,
    notes: event.notes,
    occurredAt: event.occurred_at,
  }));

  const routineEvents = timeline.filter((event) => event.type === "routine");

  // getActivity re-fetches each one (same small-N tradeoff already made
  // in recommendation.ts's decideActivity) — at most
  // RECOMMENDATIONS_TODAY_LIMIT calls, not worth a new joined query shape
  // for three rows.
  const recommendedActivities = (
    await Promise.all((recommendationsRaw ?? []).map((row) => getActivity(row.activity_id)))
  ).filter((activity): activity is Activity => activity !== null);

  return {
    sleepCount: timeline.filter((event) => event.type === "sleep").length,
    freePlayCount: timeline.filter((event) => event.type === "free_play").length,
    routineCount: routineEvents.length,
    lastRoutine: routineEvents[routineEvents.length - 1] ?? null,
    timeline,
    recommendationsToday: recommendedActivities.map(toActivitySummary),
  };
}
