import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { ageInMonths, ageLabel } from "@/lib/format";
import { eventTypeLabels, type EventType } from "@/lib/validation/events";

// Deterministic, documented limits — no vector search, no ranking, just
// "last N by time". Tune here if evidence says otherwise; nothing else in
// the codebase should hardcode a different number for the same concept.
const RECENT_EVENTS_LIMIT = 10; // day-to-day activity: sleep, routine, free_play, development
const RECENT_OBSERVATIONS_LIMIT = 5; // type = 'observation'
const RECENT_DECISIONS_LIMIT = 5; // type = 'decision'

// "Atividade" vs. "memória": sleep/routine/free_play/development are
// frequent, low-stakes logs (what happened) — kept in recentEvents.
// observation/decision are conceptually more durable ("things that keep
// mattering"), so they get their own smaller, separate buckets instead of
// being buried in a shared list of 10 mixed-type rows.
const ACTIVITY_EVENT_TYPES: EventType[] = ["sleep", "routine", "free_play", "development"];

export type ChildContextEvent = {
  type: EventType;
  notes: string;
  occurredAt: string;
};

export type ChildContext = {
  child: {
    id: string;
    name: string;
    birthDate: string | null;
    sex: string | null;
    notes: string | null;
  };
  age: {
    label: string | null; // "8 meses" / "2 anos" — for display and prompts
    months: number | null; // for the knowledge-base age filter
  };
  // Most recent first (occurred_at desc), never older data mixed in past
  // the limit above.
  recentEvents: ChildContextEvent[];
  recentObservations: ChildContextEvent[];
  recentDecisions: ChildContextEvent[];
};

// The single place that knows how to assemble "what do we know about this
// child right now" — suggestEvent/suggestReply/conversation.ts should
// never query `children`/`events` directly for this purpose; they call
// this instead. Strictly scoped by child_id, so two children (even in the
// same family) can never leak into each other's context here. Message
// history is deliberately NOT part of this: `messages` has no child_id
// column (only family_id/caregiver_id), so "what was said recently" is
// inherently a family-level concept in the current schema, not a
// child-level one — see docs/ARCHITECTURE_TARGET.md.
export async function getChildContext(
  supabase: SupabaseClient<Database>,
  childId: string,
): Promise<ChildContext | null> {
  const { data: child, error: childError } = await supabase
    .from("children")
    .select("id, name, birth_date, sex, notes")
    .eq("id", childId)
    .maybeSingle();

  if (childError || !child) {
    return null;
  }

  const [{ data: activityRaw }, { data: observationsRaw }, { data: decisionsRaw }] =
    await Promise.all([
      supabase
        .from("events")
        .select("type, notes, occurred_at")
        .eq("child_id", childId)
        .in("type", ACTIVITY_EVENT_TYPES)
        .order("occurred_at", { ascending: false })
        .limit(RECENT_EVENTS_LIMIT),
      supabase
        .from("events")
        .select("type, notes, occurred_at")
        .eq("child_id", childId)
        .eq("type", "observation")
        .order("occurred_at", { ascending: false })
        .limit(RECENT_OBSERVATIONS_LIMIT),
      supabase
        .from("events")
        .select("type, notes, occurred_at")
        .eq("child_id", childId)
        .eq("type", "decision")
        .order("occurred_at", { ascending: false })
        .limit(RECENT_DECISIONS_LIMIT),
    ]);

  const toContextEvent = (row: {
    type: string;
    notes: string;
    occurred_at: string;
  }): ChildContextEvent => ({
    type: row.type as EventType,
    notes: row.notes,
    occurredAt: row.occurred_at,
  });

  return {
    child: {
      id: child.id,
      name: child.name,
      birthDate: child.birth_date,
      sex: child.sex,
      notes: child.notes,
    },
    age: {
      label: ageLabel(child.birth_date),
      months: ageInMonths(child.birth_date),
    },
    recentEvents: (activityRaw ?? []).map(toContextEvent),
    recentObservations: (observationsRaw ?? []).map(toContextEvent),
    recentDecisions: (decisionsRaw ?? []).map(toContextEvent),
  };
}

function formatEventGroup(title: string, events: ChildContextEvent[]): string {
  if (events.length === 0) return "";
  const lines = events.map((event) => {
    const label = eventTypeLabels[event.type] ?? event.type;
    const date = new Date(event.occurredAt).toLocaleDateString("pt-BR");
    return `- [${label}] ${date}: ${event.notes}`;
  });
  return `${title}:\n${lines.join("\n")}`;
}

// Compact, predictable text block for the AI prompts — the only place
// that turns a ChildContext into prose, so suggestEvent/suggestReply never
// need to know how events are shaped or grouped. Empty groups are simply
// omitted (no "nenhum evento registrado" filler) rather than fabricating
// a sentence about missing data.
export function formatChildContextForPrompt(context: ChildContext): string {
  const parts: string[] = [
    `Criança: ${context.child.name}${context.age.label ? ` (${context.age.label})` : ""}`,
  ];

  if (context.child.notes) {
    parts.push(`Notas gerais sobre a criança: ${context.child.notes}`);
  }

  parts.push(formatEventGroup("Decisões recentes da família", context.recentDecisions));
  parts.push(formatEventGroup("Observações recentes", context.recentObservations));
  parts.push(formatEventGroup("Atividades recentes", context.recentEvents));

  return parts.filter(Boolean).join("\n\n");
}
