import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { ageInMonths, ageLabel } from "@/lib/format";
import { eventTypeLabels, type EventType } from "@/lib/validation/events";
import { mealEventPayloadSchema } from "@/lib/validation/feeding";
import { sleepEventPayloadSchema, sleepTypeLabels } from "@/lib/validation/sleep";
import { playEventPayloadSchema, activityFeedbackLabels } from "@/lib/validation/play";
import { formatDurationMinutes } from "@/lib/format";

// Deterministic, documented limits — no vector search, no ranking, just
// "last N by time". Tune here if evidence says otherwise; nothing else in
// the codebase should hardcode a different number for the same concept.
const RECENT_EVENTS_LIMIT = 10; // day-to-day activity: sleep, routine, free_play, development
const RECENT_OBSERVATIONS_LIMIT = 5; // type = 'observation'
const RECENT_DECISIONS_LIMIT = 5; // type = 'decision'

// "Atividade" vs. "memória": sleep/routine/free_play/development/meal/
// outing are frequent, low-stakes logs (what happened) — kept in
// recentEvents. observation/decision are conceptually more durable
// ("things that keep mattering"), so they get their own smaller,
// separate buckets instead of being buried in a shared list of 10
// mixed-type rows. meal/outing (Fase 8) joined this group the same way
// they joined the schema — new areas of the same "day to day" kind, not
// a new kind of memory. Exported so the dashboard's "hoje" summary
// (src/lib/dashboard.ts) filters by the exact same set instead of
// redefining it.
export const ACTIVITY_EVENT_TYPES: EventType[] = [
  "sleep",
  "routine",
  "free_play",
  "development",
  "meal",
  "outing",
];

export type ChildContextEvent = {
  type: EventType;
  notes: string;
  occurredAt: string;
  // Only meal events carry this (Fase 9) — raw jsonb, parsed defensively
  // where it's formatted (formatEventGroup) rather than here, so a
  // malformed/legacy payload never breaks context assembly, only loses
  // the extra detail for that one line.
  payload: Json;
  // Only sleep events carry this (Fase 10) — null for every other type
  // and for sleep events still in progress.
  durationMinutes: number | null;
};

// Family-level preferences (Fase 8) — not the child's own data, but part
// of what the AI should know about how this family likes to be talked to
// and what fits their routine. One row per family (family_preferences),
// created lazily the first time a family saves anything in
// /quintal/perfil — most families won't have one yet, hence the nullable
// fields and the `| null` on ChildContext.familyPreferences itself.
export type FamilyPreferences = {
  feedingNotes: string | null;
  routineNotes: string | null;
  playNotes: string | null;
  materialsNotes: string | null;
  interactionStyle: string | null;
};

export type ChildContext = {
  child: {
    id: string;
    name: string;
    birthDate: string | null;
    sex: string | null;
    notes: string | null;
    // Structured, editable in /quintal/perfil — Fase 8's answer to "o
    // Quintal precisa deixar de depender exclusivamente do histórico
    // textual da conversa". Empty array (not null) when nothing was set.
    interests: string[];
    // Fase 9: título do método (knowledge_chunks) ou o texto
    // personalizado da família — já resolvido para exibição/prompt, sem
    // o chamador precisar saber que por trás disso existe uma referência
    // a knowledge_chunks (ver src/lib/feeding.ts).
    feedingMethod: string | null;
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
  familyPreferences: FamilyPreferences | null;
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
    .select(
      "id, family_id, name, birth_date, sex, notes, interests, feeding_method_id, feeding_method_custom",
    )
    .eq("id", childId)
    .maybeSingle();

  if (childError || !child) {
    return null;
  }

  const [
    { data: activityRaw },
    { data: observationsRaw },
    { data: decisionsRaw },
    { data: preferencesRaw },
    { data: feedingMethodRaw },
  ] = await Promise.all([
    supabase
      .from("events")
      .select("type, notes, occurred_at, payload, duration_minutes")
      .eq("child_id", childId)
      .in("type", ACTIVITY_EVENT_TYPES)
      .order("occurred_at", { ascending: false })
      .limit(RECENT_EVENTS_LIMIT),
    supabase
      .from("events")
      .select("type, notes, occurred_at, payload, duration_minutes")
      .eq("child_id", childId)
      .eq("type", "observation")
      .order("occurred_at", { ascending: false })
      .limit(RECENT_OBSERVATIONS_LIMIT),
    supabase
      .from("events")
      .select("type, notes, occurred_at, payload, duration_minutes")
      .eq("child_id", childId)
      .eq("type", "decision")
      .order("occurred_at", { ascending: false })
      .limit(RECENT_DECISIONS_LIMIT),
    supabase
      .from("family_preferences")
      .select("feeding_notes, routine_notes, play_notes, materials_notes, interaction_style")
      .eq("family_id", child.family_id)
      .maybeSingle(),
    // Sem feeding_method_id, esta query simplesmente não bate com
    // nenhuma linha (id vazio não existe) — mais simples do que pular a
    // chamada condicionalmente.
    supabase
      .from("knowledge_chunks")
      .select("title")
      .eq("id", child.feeding_method_id ?? "")
      .maybeSingle(),
  ]);

  const toContextEvent = (row: {
    type: string;
    notes: string;
    occurred_at: string;
    payload: Json;
    duration_minutes: number | null;
  }): ChildContextEvent => ({
    type: row.type as EventType,
    notes: row.notes,
    occurredAt: row.occurred_at,
    payload: row.payload,
    durationMinutes: row.duration_minutes,
  });

  return {
    child: {
      id: child.id,
      name: child.name,
      birthDate: child.birth_date,
      sex: child.sex,
      notes: child.notes,
      interests: child.interests,
      feedingMethod: feedingMethodRaw?.title ?? child.feeding_method_custom,
    },
    age: {
      label: ageLabel(child.birth_date),
      months: ageInMonths(child.birth_date),
    },
    recentEvents: (activityRaw ?? []).map(toContextEvent),
    recentObservations: (observationsRaw ?? []).map(toContextEvent),
    recentDecisions: (decisionsRaw ?? []).map(toContextEvent),
    familyPreferences: preferencesRaw
      ? {
          feedingNotes: preferencesRaw.feeding_notes,
          routineNotes: preferencesRaw.routine_notes,
          playNotes: preferencesRaw.play_notes,
          materialsNotes: preferencesRaw.materials_notes,
          interactionStyle: preferencesRaw.interaction_style,
        }
      : null,
  };
}

// Meal events (Fase 9) carry a structured payload (slot/foods/acceptance)
// beyond the free-text `notes` every event already has — when it parses
// cleanly, the prompt line gets the real foods and acceptance instead of
// just repeating `notes` (which is often just the foods list anyway, but
// acceptance is real signal `notes` alone doesn't carry).
function formatMealDetail(payload: Json): string | null {
  const parsed = mealEventPayloadSchema.safeParse(payload);
  if (!parsed.success) return null;
  const { foods, acceptance } = parsed.data;
  const acceptanceLabel =
    { ate_well: "comeu bem", ate_some: "comeu pouco", refused: "recusou", unknown: null }[acceptance] ?? null;
  const parts = [foods.length > 0 ? foods.join(", ") : null, acceptanceLabel].filter(Boolean);
  return parts.length > 0 ? parts.join(" — ") : null;
}

// Sleep events (Fase 10) carry a structured payload (sleepType/endedAt)
// beyond `notes` — when it parses cleanly, the prompt line says "Soneca
// — 1h35" (or "em andamento" for a period not yet ended) instead of just
// repeating whatever fallback text `notes` happened to get at write
// time. Legacy 'sleep' events without this payload (Fase 3-8) fall back
// to null, same as formatMealDetail's own defensive parse.
function formatSleepDetail(payload: Json, durationMinutes: number | null): string | null {
  const parsed = sleepEventPayloadSchema.safeParse(payload);
  if (!parsed.success) return null;
  const label = sleepTypeLabels[parsed.data.sleepType];
  if (parsed.data.endedAt === null) return `${label} (em andamento)`;
  return durationMinutes !== null ? `${label} — ${formatDurationMinutes(durationMinutes)}` : label;
}

// Activity events (Fase 11) carry activityTitle + feedback in payload —
// mesma ideia de formatMealDetail/formatSleepDetail: enriquece a linha
// do prompt com o resultado real ("Cabana — Adorou") em vez de só
// repetir `notes` (que já é essencialmente isso, mas via payload fica
// resiliente a uma futura mudança no formato de notes).
function formatPlayDetail(payload: Json): string | null {
  const parsed = playEventPayloadSchema.safeParse(payload);
  if (!parsed.success) return null;
  return `${parsed.data.activityTitle} — ${activityFeedbackLabels[parsed.data.feedback]}`;
}

function formatEventGroup(title: string, events: ChildContextEvent[]): string {
  if (events.length === 0) return "";
  const lines = events.map((event) => {
    const label = eventTypeLabels[event.type] ?? event.type;
    const date = new Date(event.occurredAt).toLocaleDateString("pt-BR");
    const mealDetail = event.type === "meal" ? formatMealDetail(event.payload) : null;
    const sleepDetail = event.type === "sleep" ? formatSleepDetail(event.payload, event.durationMinutes) : null;
    const playDetail = event.type === "free_play" ? formatPlayDetail(event.payload) : null;
    return `- [${label}] ${date}: ${mealDetail ?? sleepDetail ?? playDetail ?? event.notes}`;
  });
  return `${title}:\n${lines.join("\n")}`;
}

function formatFamilyPreferences(preferences: FamilyPreferences | null): string {
  if (!preferences) return "";
  const lines = [
    preferences.feedingNotes ? `- Alimentação: ${preferences.feedingNotes}` : null,
    preferences.routineNotes ? `- Rotina: ${preferences.routineNotes}` : null,
    preferences.playNotes ? `- Brincadeiras: ${preferences.playNotes}` : null,
    preferences.materialsNotes ? `- Materiais: ${preferences.materialsNotes}` : null,
    preferences.interactionStyle ? `- Estilo de interação preferido: ${preferences.interactionStyle}` : null,
  ].filter((line): line is string => line !== null);

  if (lines.length === 0) return "";
  return `Preferências da família:\n${lines.join("\n")}`;
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

  if (context.child.interests.length > 0) {
    parts.push(`Interesses observados: ${context.child.interests.join(", ")}`);
  }

  if (context.child.feedingMethod) {
    parts.push(`Método alimentar escolhido pela família: ${context.child.feedingMethod}`);
  }

  parts.push(formatFamilyPreferences(context.familyPreferences));
  parts.push(formatEventGroup("Decisões recentes da família", context.recentDecisions));
  parts.push(formatEventGroup("Observações recentes", context.recentObservations));
  parts.push(formatEventGroup("Atividades recentes", context.recentEvents));

  return parts.filter(Boolean).join("\n\n");
}
