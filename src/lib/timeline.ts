import { createServiceClient } from "@/lib/supabase/service";
import { ACTIVITY_EVENT_TYPES } from "@/lib/childContext";
import { mealEventPayloadSchema, mealSlotLabels, mealAcceptanceLabels } from "@/lib/validation/feeding";
import { sleepEventPayloadSchema, sleepTypeLabels } from "@/lib/validation/sleep";
import { playEventPayloadSchema, activityFeedbackLabels } from "@/lib/validation/play";
import { hygieneEventPayloadSchema, diaperResultLabels, diaperConditionLabels } from "@/lib/validation/hygiene";
import { eventTypeLabels, type EventType, type EventOrigin } from "@/lib/validation/events";
import { formatDurationMinutes } from "@/lib/format";
import type { Json } from "@/lib/supabase/types";

// ---------------------------------------------------------------------
// Timeline central (Fase 13) — consolida os eventos de todos os módulos
// (Alimentação, Sono, Brincadeiras, e os tipos criados via /ops:
// Rotina, Desenvolvimento, Passeio, Observação) numa única lista
// cronológica, com filtro, edição e exclusão. Nenhuma tabela nova: tudo
// já vive em `events`, só ganhou uma leitura/formatação unificada e
// (pela primeira vez no produto) update/delete. Ver
// docs/ARCHITECTURE_TARGET.md, "Timeline central (Fase 13)".
// ---------------------------------------------------------------------

// ACTIVITY_EVENT_TYPES (childContext.ts) + observation — a timeline
// mostra observações também (pedido explícito), mas ChildContext
// mantém observation numa seção própria do prompt (recentObservations),
// então esse conjunto NÃO substitui ACTIVITY_EVENT_TYPES em nenhum
// outro lugar, só é usado aqui.
export const TIMELINE_EVENT_TYPES: EventType[] = [...ACTIVITY_EVENT_TYPES, "observation"];

export type TimelineEntry = {
  id: string;
  type: EventType;
  occurredAt: string;
  notes: string;
  payload: Json;
  durationMinutes: number | null;
  origin: EventOrigin;
};

type EventRow = {
  id: string;
  type: string;
  occurred_at: string;
  notes: string;
  payload: Json;
  duration_minutes: number | null;
  origin: string;
};

function toTimelineEntry(row: EventRow): TimelineEntry {
  return {
    id: row.id,
    type: row.type as EventType,
    occurredAt: row.occurred_at,
    notes: row.notes,
    payload: row.payload,
    durationMinutes: row.duration_minutes,
    origin: row.origin as EventOrigin,
  };
}

const EVENT_COLUMNS = "id, type, occurred_at, notes, payload, duration_minutes, origin";

export async function getTimelineEntries(
  childId: string,
  range: { since: string; until: string },
): Promise<TimelineEntry[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("child_id", childId)
    .in("type", TIMELINE_EVENT_TYPES)
    .gte("occurred_at", range.since)
    .lt("occurred_at", range.until)
    .order("occurred_at", { ascending: true });

  return (data ?? []).map(toTimelineEntry);
}

export async function getTimelineEntry(eventId: string): Promise<(TimelineEntry & { childId: string }) | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("events")
    .select(`child_id, ${EVENT_COLUMNS}`)
    .eq("id", eventId)
    .maybeSingle();

  if (!data) return null;
  return { ...toTimelineEntry(data), childId: data.child_id };
}

// Só os dois campos que todo evento tem de verdade — ver
// eventEditInputSchema (validation/events.ts) para o porquê. Sono é o
// único caso especial: se o período já tem fim registrado, a duração
// precisa ser recalculada a partir do novo início, senão ficaria
// mentindo depois da edição.
export async function updateTimelineEntry(input: {
  eventId: string;
  childId: string;
  occurredAt: string;
  notes: string;
}): Promise<void> {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("events")
    .select("id, child_id, type, payload")
    .eq("id", input.eventId)
    .maybeSingle();

  if (!existing || existing.child_id !== input.childId) {
    throw new Error("Evento não encontrado.");
  }

  const patch: { occurred_at: string; notes: string; duration_minutes?: number } = {
    occurred_at: input.occurredAt,
    notes: input.notes,
  };

  if (existing.type === "sleep") {
    const parsed = sleepEventPayloadSchema.safeParse(existing.payload);
    if (parsed.success && parsed.data.endedAt) {
      const ms = new Date(parsed.data.endedAt).getTime() - new Date(input.occurredAt).getTime();
      patch.duration_minutes = Math.max(0, Math.round(ms / 60000));
    }
  }

  const { error } = await supabase.from("events").update(patch).eq("id", input.eventId);
  if (error) {
    console.error("Failed to update timeline entry", error);
    throw new Error("Não foi possível salvar as alterações.");
  }
}

export async function deleteTimelineEntry(eventId: string, childId: string): Promise<void> {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("events")
    .select("id, child_id")
    .eq("id", eventId)
    .maybeSingle();

  if (!existing || existing.child_id !== childId) {
    throw new Error("Evento não encontrado.");
  }

  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) {
    console.error("Failed to delete timeline entry", error);
    throw new Error("Não foi possível excluir.");
  }
}

// ---------------------------------------------------------------------
// Formatação para exibição — funções puras (sem acesso a banco),
// reaproveitadas tanto pela Timeline central quanto pelo resumo
// compacto do Dashboard (src/components/dashboard/Timeline.tsx), para
// que as duas nunca divirjam em como descrevem o mesmo evento.
// ---------------------------------------------------------------------

export type TimelineIcon =
  | "sleep"
  | "wake"
  | "meal"
  | "play"
  | "outing"
  | "routine"
  | "development"
  | "observation"
  | "hygiene";

// O verbo/ícone principal de um evento — "Café da manhã"/"Almoço" em vez
// do genérico "Refeição" quando o payload tem o slot (Fase 9); "Soneca"
// vs. "Sono noturno" quando o payload tem o tipo (Fase 10). Sem payload
// estruturado (eventos antigos, ou tipos sem payload como rotina/
// desenvolvimento/passeio/observação), cai no rótulo genérico do tipo.
export function describeEntry(entry: Pick<TimelineEntry, "type" | "payload">): { verb: string; icon: TimelineIcon } {
  switch (entry.type) {
    case "meal": {
      const parsed = mealEventPayloadSchema.safeParse(entry.payload);
      return { verb: parsed.success ? mealSlotLabels[parsed.data.slot] : eventTypeLabels.meal, icon: "meal" };
    }
    case "sleep": {
      const parsed = sleepEventPayloadSchema.safeParse(entry.payload);
      return { verb: parsed.success ? sleepTypeLabels[parsed.data.sleepType] : eventTypeLabels.sleep, icon: "sleep" };
    }
    case "free_play":
      return { verb: "Brincadeira", icon: "play" };
    case "outing":
      return { verb: eventTypeLabels.outing, icon: "outing" };
    case "routine":
      return { verb: eventTypeLabels.routine, icon: "routine" };
    case "development":
      return { verb: eventTypeLabels.development, icon: "development" };
    case "observation":
      return { verb: eventTypeLabels.observation, icon: "observation" };
    case "hygiene": {
      const parsed = hygieneEventPayloadSchema.safeParse(entry.payload);
      return { verb: parsed.success ? diaperResultLabels[parsed.data.diaperResult] : eventTypeLabels.hygiene, icon: "hygiene" };
    }
    default:
      return { verb: eventTypeLabels[entry.type] ?? entry.type, icon: "routine" };
  }
}

// 0-2 linhas de detalhe abaixo do verbo — "Banana + pão", "43 min",
// "Empilhar blocos" + "Gostou muito" — o formato ilustrativo pedido
// nesta fase. Cai em `notes` (o texto livre que todo evento sempre tem)
// quando o payload não é do formato esperado, nunca fica em branco à
// toa.
export function getTimelineDetailLines(entry: Pick<TimelineEntry, "type" | "payload" | "notes" | "durationMinutes">): string[] {
  switch (entry.type) {
    case "meal": {
      const parsed = mealEventPayloadSchema.safeParse(entry.payload);
      if (!parsed.success) return entry.notes ? [entry.notes] : [];
      const lines: string[] = [];
      if (parsed.data.foods.length > 0) lines.push(parsed.data.foods.join(", "));
      if (parsed.data.acceptance !== "unknown") lines.push(mealAcceptanceLabels[parsed.data.acceptance]);
      return lines.length > 0 ? lines : entry.notes ? [entry.notes] : [];
    }
    case "sleep": {
      const parsed = sleepEventPayloadSchema.safeParse(entry.payload);
      if (!parsed.success) return entry.notes ? [entry.notes] : [];
      if (parsed.data.endedAt === null) return ["Em andamento"];
      return entry.durationMinutes !== null ? [formatDurationMinutes(entry.durationMinutes)] : [];
    }
    case "free_play": {
      const parsed = playEventPayloadSchema.safeParse(entry.payload);
      if (!parsed.success) return entry.notes ? [entry.notes] : [];
      // feedback é null para um registro livre vindo do chat sem reação
      // explícita (Fase 15) — nesse caso mostra a duração (quando houver)
      // no lugar, nunca um rótulo de feedback inventado.
      const secondLine =
        parsed.data.feedback !== null
          ? activityFeedbackLabels[parsed.data.feedback]
          : entry.durationMinutes !== null
            ? formatDurationMinutes(entry.durationMinutes)
            : null;
      return secondLine ? [parsed.data.activityTitle, secondLine] : [parsed.data.activityTitle];
    }
    case "hygiene": {
      const parsed = hygieneEventPayloadSchema.safeParse(entry.payload);
      if (!parsed.success) return entry.notes ? [entry.notes] : [];
      // "Fralda normal" é o caso comum (sem nada a destacar); condição
      // fora do normal (vazou/muito cheia) é o que vale mostrar em
      // destaque — mesmo formato ilustrativo do pedido desta fase
      // ("💧💧 Vazamento").
      return parsed.data.condition === "normal"
        ? ["Fralda normal"]
        : [diaperConditionLabels[parsed.data.condition]];
    }
    default:
      return entry.notes ? [entry.notes] : [];
  }
}

export type TimelineDisplayEntry = {
  // O event.id real — para onde o link de "ver detalhes" aponta, mesmo
  // numa linha sintética de "Acordou" (ver abaixo).
  id: string;
  // Chave única de renderização — um período de sono pode virar DUAS
  // linhas na tela (o período em si + "Acordou" no dia do despertar),
  // então id sozinho não basta como React key.
  displayKey: string;
  sortAt: string;
  timeLabel: string;
  verb: string;
  icon: TimelineIcon;
  detailLines: string[];
  origin: EventOrigin;
  type: EventType;
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function toDisplayEntry(entry: TimelineEntry): TimelineDisplayEntry {
  const { verb, icon } = describeEntry(entry);
  return {
    id: entry.id,
    displayKey: entry.id,
    sortAt: entry.occurredAt,
    timeLabel: formatTime(entry.occurredAt),
    verb,
    icon,
    detailLines: getTimelineDetailLines(entry),
    origin: entry.origin,
    type: entry.type,
  };
}

// O dia inteiro de um sono noturno que atravessa a meia-noite —
// simplificação documentada desde a Fase 10 ("aparece inteiro no dia em
// que começou") — ganha aqui a única exceção: se a criança acordou
// DENTRO do dia sendo visto, uma segunda linha sintética "Acordou"
// aparece nesse dia, no horário real do despertar (a linha do período
// em si, com a duração, continua só no dia em que começou). Não é uma
// segunda linha no banco — é puramente de exibição, os dois pontos
// apontam pro mesmo evento (mesmo `id`).
async function getPriorNightWakeEntries(
  childId: string,
  range: { since: string; until: string },
): Promise<TimelineDisplayEntry[]> {
  const lookback = new Date(new Date(range.since).getTime() - 24 * 60 * 60 * 1000).toISOString();

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("child_id", childId)
    .eq("type", "sleep")
    .gte("occurred_at", lookback)
    .lt("occurred_at", range.since)
    .order("occurred_at", { ascending: false })
    .limit(3);

  const wakeEntries: TimelineDisplayEntry[] = [];
  for (const row of data ?? []) {
    const entry = toTimelineEntry(row);
    const parsed = sleepEventPayloadSchema.safeParse(entry.payload);
    if (!parsed.success || parsed.data.sleepType !== "night" || !parsed.data.endedAt) continue;
    if (parsed.data.endedAt < range.since || parsed.data.endedAt >= range.until) continue;

    wakeEntries.push({
      id: entry.id,
      displayKey: `${entry.id}-wake`,
      sortAt: parsed.data.endedAt,
      timeLabel: formatTime(parsed.data.endedAt),
      verb: "Acordou",
      icon: "wake",
      detailLines: [],
      origin: entry.origin,
      type: "sleep",
    });
  }
  return wakeEntries;
}

// A função principal por trás de /quintal/timeline: um dia completo,
// já pronto para renderizar (ordenado, com o "Acordou" sintético
// quando aplicável).
export async function getDayTimeline(
  childId: string,
  range: { since: string; until: string },
): Promise<TimelineDisplayEntry[]> {
  const [entries, wakeEntries] = await Promise.all([
    getTimelineEntries(childId, range),
    getPriorNightWakeEntries(childId, range),
  ]);

  return [...entries.map(toDisplayEntry), ...wakeEntries].sort((a, b) => a.sortAt.localeCompare(b.sortAt));
}

// FILTROS pedidos: todos/sono/alimentação/brincadeiras/rotina — só
// cinco opções para sete tipos reais, então "brincadeiras" também
// cobre passeio (o vizinho mais próximo, mesma decisão já tomada para
// a biblioteca de Materiais, Fase 12) e "rotina" vira o balde para tudo
// que não é sono/alimentação/brincadeira: rotina, desenvolvimento e
// observação.
export const TIMELINE_FILTERS = ["sono", "alimentacao", "brincadeiras", "rotina"] as const;
export type TimelineFilter = (typeof TIMELINE_FILTERS)[number];

export const TIMELINE_FILTER_LABELS: Record<TimelineFilter, string> = {
  sono: "Sono",
  alimentacao: "Alimentação",
  brincadeiras: "Brincadeiras",
  rotina: "Rotina",
};

export const TIMELINE_FILTER_TYPES: Record<TimelineFilter, EventType[]> = {
  sono: ["sleep"],
  alimentacao: ["meal"],
  brincadeiras: ["free_play", "outing"],
  rotina: ["routine", "development", "observation", "hygiene"],
};

export function isTimelineFilter(value: string | undefined): value is TimelineFilter {
  return (TIMELINE_FILTERS as readonly string[]).includes(value ?? "");
}
