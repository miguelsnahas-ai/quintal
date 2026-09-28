import { createServiceClient } from "@/lib/supabase/service";
import { startOfToday } from "@/lib/format";
import { sleepEventPayloadSchema, sleepTypeLabels, type SleepType, type SleepEventPayload } from "@/lib/validation/sleep";
import type { EventOrigin } from "@/lib/validation/events";
import type { Json } from "@/lib/supabase/types";

const SLEEP_HISTORY_LIMIT = 30;

// ---------------------------------------------------------------------
// Registro de sono — events.type = 'sleep' (já existia desde a Fase 3)
// + payload estruturado (Fase 10), mesmo padrão já usado por 'meal'
// (Fase 9): nenhuma tabela nova, nenhuma coluna nova — events.payload já
// era reservado para exatamente isso, e events.duration_minutes já
// existia desde a Fase 8. Ver docs/ARCHITECTURE_TARGET.md, "Módulo de
// Sono (Fase 10)".
// ---------------------------------------------------------------------

function computeDurationMinutes(startedAt: string, endedAt: string): number {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  // Nunca negativo — um horário de fim digitado errado (antes do início)
  // não deve quebrar o registro, só zerar a duração; a família ainda
  // pode corrigir o horário depois.
  return Math.max(0, Math.round(ms / 60000));
}

export type SleepHistoryEntry = {
  id: string;
  // null só para eventos 'sleep' antigos (Fase 3-8, sem payload
  // estruturado) — nunca inventamos qual tipo teria sido.
  sleepType: SleepType | null;
  startedAt: string;
  endedAt: string | null; // null = ainda em andamento
  durationMinutes: number | null;
  notes: string;
};

type SleepEventRow = {
  id: string;
  occurred_at: string;
  notes: string;
  duration_minutes: number | null;
  payload: Json;
};

function toSleepHistoryEntry(row: SleepEventRow): SleepHistoryEntry {
  const parsed = sleepEventPayloadSchema.safeParse(row.payload);
  return {
    id: row.id,
    sleepType: parsed.success ? parsed.data.sleepType : null,
    startedAt: row.occurred_at,
    endedAt: parsed.success ? parsed.data.endedAt : null,
    durationMinutes: row.duration_minutes,
    notes: row.notes,
  };
}

// "Começou a dormir" — grava só o início, duration_minutes fica null até
// a família registrar que a criança acordou (endSleep, abaixo). É
// responsabilidade do chamador (a action) garantir que não existe outro
// período em aberto antes de chamar isso — ver getOpenSleepSession.
export async function startSleep(input: {
  childId: string;
  sleepType: SleepType;
  startedAt: string;
  notes: string | null;
  origin: EventOrigin;
  sourceMessageId?: string | null;
}): Promise<{ id: string }> {
  const supabase = createServiceClient();

  const payload: SleepEventPayload = { sleepType: input.sleepType, endedAt: null };
  const notes = input.notes?.trim() || sleepTypeLabels[input.sleepType];

  const { data, error } = await supabase
    .from("events")
    .insert({
      child_id: input.childId,
      type: "sleep",
      occurred_at: input.startedAt,
      notes,
      payload: payload as unknown as Json,
      duration_minutes: null,
      origin: input.origin,
      source_message_id: input.sourceMessageId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to start sleep event", error);
    throw new Error("Não foi possível registrar o início do sono.");
  }

  return { id: data.id };
}

// "Acordou" — fecha um período já em aberto: calcula a duração a partir
// do occurred_at já gravado no início, grava duration_minutes e marca
// payload.endedAt. Só a página que abre esse fluxo conhece o event_id
// (veio de getOpenSleepSession) — validamos aqui de novo, em vez de
// confiar cegamente no que veio do formulário.
export async function endSleep(input: {
  eventId: string;
  childId: string;
  endedAt: string;
  notes: string | null;
}): Promise<{ id: string }> {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("events")
    .select("id, child_id, type, occurred_at, notes, payload")
    .eq("id", input.eventId)
    .maybeSingle();

  if (!existing || existing.child_id !== input.childId || existing.type !== "sleep") {
    throw new Error("Registro de sono não encontrado.");
  }

  const parsed = sleepEventPayloadSchema.safeParse(existing.payload);
  if (!parsed.success || parsed.data.endedAt !== null) {
    throw new Error("Esse período de sono já foi encerrado.");
  }

  const durationMinutes = computeDurationMinutes(existing.occurred_at, input.endedAt);
  const payload: SleepEventPayload = { sleepType: parsed.data.sleepType, endedAt: input.endedAt };
  const notes = input.notes?.trim() || existing.notes || sleepTypeLabels[parsed.data.sleepType];

  const { error } = await supabase
    .from("events")
    .update({ payload: payload as unknown as Json, duration_minutes: durationMinutes, notes })
    .eq("id", input.eventId);

  if (error) {
    console.error("Failed to end sleep event", error);
    throw new Error("Não foi possível registrar que a criança acordou.");
  }

  return { id: input.eventId };
}

// Registro retroativo: início e fim de uma vez só, para quando a família
// esquece de registrar em tempo real (pedido explícito desta fase). Um
// único INSERT, já fechado — nunca passa pelo estado "em aberto".
export async function recordSleepPeriod(input: {
  childId: string;
  sleepType: SleepType;
  startedAt: string;
  endedAt: string;
  notes: string | null;
  origin: EventOrigin;
  sourceMessageId?: string | null;
}): Promise<{ id: string }> {
  const supabase = createServiceClient();

  const durationMinutes = computeDurationMinutes(input.startedAt, input.endedAt);
  const payload: SleepEventPayload = { sleepType: input.sleepType, endedAt: input.endedAt };
  const notes = input.notes?.trim() || sleepTypeLabels[input.sleepType];

  const { data, error } = await supabase
    .from("events")
    .insert({
      child_id: input.childId,
      type: "sleep",
      occurred_at: input.startedAt,
      notes,
      payload: payload as unknown as Json,
      duration_minutes: durationMinutes,
      origin: input.origin,
      source_message_id: input.sourceMessageId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to record sleep period", error);
    throw new Error("Não foi possível registrar esse período de sono.");
  }

  return { id: data.id };
}

export type OpenSleepSession = {
  id: string;
  sleepType: SleepType;
  startedAt: string;
};

// Um período "em aberto" é um evento 'sleep' cujo payload tem sleepType
// (ou seja: passou por este módulo, não é um registro antigo/manual da
// Fase 8) e endedAt ainda nulo. As duas condições evitam que um evento
// 'sleep' antigo sem payload estruturado (duration_minutes também nulo,
// mas por falta de dado, não por estar em andamento) seja confundido com
// "a criança está dormindo agora".
export async function getOpenSleepSession(childId: string): Promise<OpenSleepSession | null> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("events")
    .select("id, occurred_at, payload")
    .eq("child_id", childId)
    .eq("type", "sleep")
    .not("payload->>sleepType", "is", null)
    .is("payload->>endedAt", null)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const parsed = sleepEventPayloadSchema.safeParse(data.payload);
  if (!parsed.success || parsed.data.endedAt !== null) return null; // defensivo, não deveria acontecer dado o filtro acima

  return { id: data.id, sleepType: parsed.data.sleepType, startedAt: data.occurred_at };
}

// Mais recente primeiro — a página agrupa em "Hoje"/"Ontem"/etc., mesmo
// padrão de getMealHistory (Fase 9).
export async function getSleepHistory(childId: string, limit = SLEEP_HISTORY_LIMIT): Promise<SleepHistoryEntry[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("events")
    .select("id, occurred_at, notes, duration_minutes, payload")
    .eq("child_id", childId)
    .eq("type", "sleep")
    .order("occurred_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map(toSleepHistoryEntry);
}

export type SleepSummary = {
  napCount: number;
  napTotalMinutes: number;
  lastPeriod: SleepHistoryEntry | null;
  openSession: OpenSleepSession | null;
};

// "Sono de hoje" — usado tanto pelo Dashboard (resumo compacto) quanto
// pela própria página de Sono (seção "Resumo"). openSession é buscado à
// parte porque um sono noturno pode ter começado ontem e ainda estar em
// andamento — filtrar só por "hoje" o perderia.
export async function getTodaySleepSummary(childId: string): Promise<SleepSummary> {
  const supabase = createServiceClient();
  const since = startOfToday();

  const [{ data: todayRaw }, openSession] = await Promise.all([
    supabase
      .from("events")
      .select("id, occurred_at, notes, duration_minutes, payload")
      .eq("child_id", childId)
      .eq("type", "sleep")
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: true }),
    getOpenSleepSession(childId),
  ]);

  const entries = (todayRaw ?? []).map(toSleepHistoryEntry);
  const naps = entries.filter((entry) => entry.sleepType === "nap" && entry.durationMinutes !== null);
  const napTotalMinutes = naps.reduce((sum, entry) => sum + (entry.durationMinutes ?? 0), 0);

  return {
    napCount: naps.length,
    napTotalMinutes,
    lastPeriod: entries[entries.length - 1] ?? null,
    openSession,
  };
}
