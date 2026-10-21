import { createServiceClient } from "@/lib/supabase/service";
import { startOfToday } from "@/lib/format";
import {
  hygieneEventPayloadSchema,
  diaperResultLabels,
  diaperConditionLabels,
  skinConditionLabels,
  type DiaperResult,
  type DiaperCondition,
  type SkinCondition,
  type HygieneEventPayload,
} from "@/lib/validation/hygiene";
import { getHygieneInsightMessages } from "@/lib/hygieneInsights";
import type { EventOrigin } from "@/lib/validation/events";
import type { Json } from "@/lib/supabase/types";

const HYGIENE_HISTORY_LIMIT = 50;
const INSIGHTS_WINDOW_DAYS = 7;

// ---------------------------------------------------------------------
// Troca de fralda — events.type = 'hygiene' (Fase Higiene), mesmo padrão
// já usado por 'meal'/'sleep': nenhuma tabela nova para o registro em si,
// payload estruturado carrega o que o tipo precisa. Ver
// src/lib/validation/hygiene.ts e a migração desta fase.
// ---------------------------------------------------------------------

// Os três campos são nuláveis — null só para eventos 'hygiene' sem
// payload estruturado: o fallback genérico do chat (conversation.ts)
// pode criar um evento de qualquer tipo, incluindo 'hygiene', só com
// tipo+notas (sem passar por este módulo), mesma situação que
// sleepType/endedAt já tratam em sleep.ts. Nunca inventamos qual teria
// sido o valor — a UI cai para `notes`/um rótulo genérico nesse caso.
export type HygieneHistoryEntry = {
  id: string;
  occurredAt: string;
  diaperResult: DiaperResult | null;
  condition: DiaperCondition | null;
  skinCondition: SkinCondition | null;
  notes: string;
};

type HygieneEventRow = {
  id: string;
  occurred_at: string;
  notes: string;
  payload: Json;
};

function toHygieneHistoryEntry(row: HygieneEventRow): HygieneHistoryEntry {
  const parsed = hygieneEventPayloadSchema.safeParse(row.payload);
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    diaperResult: parsed.success ? parsed.data.diaperResult : null,
    condition: parsed.success ? parsed.data.condition : null,
    skinCondition: parsed.success ? parsed.data.skinCondition : null,
    notes: row.notes,
  };
}

// Nota de fallback honesta quando a família não digita nada — igual
// recordMealEvent: nunca um texto genérico tipo "Evento", sempre algo
// que descreve o que foi de fato selecionado no formulário rápido.
function buildFallbackNote(result: DiaperResult, condition: DiaperCondition, skin: SkinCondition): string {
  const parts = [diaperResultLabels[result]];
  if (condition !== "normal") parts.push(diaperConditionLabels[condition].toLowerCase());
  if (skin !== "normal") parts.push(`pele ${skinConditionLabels[skin].toLowerCase()}`);
  return parts.join(" — ");
}

// O único ponto de criação de uma troca — hoje só o formulário rápido
// chama isto (origin: 'manual'), já pronto para uma extração futura via
// chat chamar com origin: 'chat' sem mudar nada aqui, mesmo espírito de
// recordMealEvent (src/lib/feeding.ts).
export async function recordDiaperChange(input: {
  childId: string;
  diaperResult: DiaperResult;
  condition: DiaperCondition;
  skinCondition: SkinCondition;
  occurredAt: string;
  notes: string | null;
  origin: EventOrigin;
  sourceMessageId?: string | null;
  caregiverId?: string | null;
}): Promise<{ id: string }> {
  const supabase = createServiceClient();

  const payload: HygieneEventPayload = {
    diaperResult: input.diaperResult,
    condition: input.condition,
    skinCondition: input.skinCondition,
  };

  const notes = input.notes?.trim() || buildFallbackNote(input.diaperResult, input.condition, input.skinCondition);

  const { data, error } = await supabase
    .from("events")
    .insert({
      child_id: input.childId,
      type: "hygiene",
      occurred_at: input.occurredAt,
      notes,
      payload: payload as unknown as Json,
      origin: input.origin,
      source_message_id: input.sourceMessageId ?? null,
      caregiver_id: input.caregiverId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to record diaper change", error);
    throw new Error("Não foi possível registrar a troca.");
  }

  return { id: data.id };
}

// Mais recente primeiro — a página de Histórico agrupa por dia
// (groupByDay, mesmo padrão de Sono/Alimentação).
export async function getHygieneHistory(childId: string, limit = HYGIENE_HISTORY_LIMIT): Promise<HygieneHistoryEntry[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("events")
    .select("id, occurred_at, notes, payload")
    .eq("child_id", childId)
    .eq("type", "hygiene")
    .order("occurred_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map(toHygieneHistoryEntry);
}

export type HygieneOverview = {
  lastChange: HygieneHistoryEntry | null;
  changesToday: number;
  // Distribuição de hoje — xixi/cocô/os dois, as mesmas categorias do
  // formulário de registro, sem inventar nenhuma outra.
  todayDistribution: { pee: number; poop: number; both: number };
  recentLeakCount: number; // últimos INSIGHTS_WINDOW_DAYS dias
  currentDiaperSize: string | null;
  stock: DiaperStockLine[];
  insights: string[];
};

// A tela "Visão geral" (critério explícito: última troca, trocas hoje,
// distribuição xixi/cocô, vazamentos recentes, tamanho atual, estoque
// quando informado) — uma função só, mesmo papel de getTodaySleepSummary
// para o módulo Sono.
export async function getHygieneOverview(childId: string): Promise<HygieneOverview> {
  const supabase = createServiceClient();
  const since = startOfToday();
  const insightsSince = new Date();
  insightsSince.setDate(insightsSince.getDate() - INSIGHTS_WINDOW_DAYS);

  const [{ data: lastRaw }, { data: todayRaw }, { data: insightsRaw }, currentProfile, stock] = await Promise.all([
    supabase
      .from("events")
      .select("id, occurred_at, notes, payload")
      .eq("child_id", childId)
      .eq("type", "hygiene")
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("events")
      .select("id, occurred_at, notes, payload")
      .eq("child_id", childId)
      .eq("type", "hygiene")
      .gte("occurred_at", since),
    supabase
      .from("events")
      .select("occurred_at, payload")
      .eq("child_id", childId)
      .eq("type", "hygiene")
      .gte("occurred_at", insightsSince.toISOString()),
    getCurrentDiaperProfile(childId),
    getDiaperStock(childId),
  ]);

  const todayEntries = (todayRaw ?? []).map(toHygieneHistoryEntry);
  const todayDistribution = { pee: 0, poop: 0, both: 0 };
  for (const entry of todayEntries) {
    if (entry.diaperResult) todayDistribution[entry.diaperResult] += 1;
  }

  const insightEntries = (insightsRaw ?? [])
    .map((row: { occurred_at: string; payload: Json }) => {
      const parsed = hygieneEventPayloadSchema.safeParse(row.payload);
      return parsed.success ? { occurredAt: row.occurred_at, condition: parsed.data.condition } : null;
    })
    .filter((entry): entry is { occurredAt: string; condition: DiaperCondition } => entry !== null);

  return {
    lastChange: lastRaw ? toHygieneHistoryEntry(lastRaw) : null,
    changesToday: todayEntries.length,
    todayDistribution,
    recentLeakCount: insightEntries.filter((entry) => entry.condition === "leaked").length,
    currentDiaperSize: currentProfile?.size ?? null,
    stock,
    insights: getHygieneInsightMessages(insightEntries, INSIGHTS_WINDOW_DAYS, new Date()),
  };
}

// ---------------------------------------------------------------------
// Fralda (perfil) — diaper_profiles, entidade própria (ver migração:
// "estado que vale por um período", não um evento pontual). Histórico
// completo fica consultável (getDiaperProfiles); "a fralda atual" é
// sempre a linha mais recente por started_at.
// ---------------------------------------------------------------------

export type DiaperProfile = {
  id: string;
  brand: string | null;
  model: string | null;
  size: string | null;
  startedAt: string;
  notes: string | null;
};

export async function getDiaperProfiles(childId: string): Promise<DiaperProfile[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("diaper_profiles")
    .select("id, brand, model, size, started_at, notes")
    .eq("child_id", childId)
    .order("started_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    brand: row.brand,
    model: row.model,
    size: row.size,
    startedAt: row.started_at,
    notes: row.notes,
  }));
}

export async function getCurrentDiaperProfile(childId: string): Promise<DiaperProfile | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("diaper_profiles")
    .select("id, brand, model, size, started_at, notes")
    .eq("child_id", childId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return { id: data.id, brand: data.brand, model: data.model, size: data.size, startedAt: data.started_at, notes: data.notes };
}

export async function createDiaperProfile(input: {
  childId: string;
  brand: string | null;
  model: string | null;
  size: string | null;
  startedAt: string;
  notes: string | null;
  createdBy?: string | null;
}): Promise<{ id: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("diaper_profiles")
    .insert({
      child_id: input.childId,
      brand: input.brand,
      model: input.model,
      size: input.size,
      started_at: input.startedAt,
      notes: input.notes,
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to create diaper profile", error);
    throw new Error("Não foi possível salvar a fralda.");
  }

  return { id: data.id };
}

// ---------------------------------------------------------------------
// Estoque — diaper_stock, várias linhas por criança (tamanhos/marcas
// diferentes ao mesmo tempo). Sem cálculo de consumo/duração (pedido
// explícito desta fase) — só o que foi informado.
// ---------------------------------------------------------------------

export type DiaperStockLine = {
  id: string;
  brand: string | null;
  model: string | null;
  size: string | null;
  quantity: number;
};

export async function getDiaperStock(childId: string): Promise<DiaperStockLine[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("diaper_stock")
    .select("id, brand, model, size, quantity")
    .eq("child_id", childId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((row) => ({ id: row.id, brand: row.brand, model: row.model, size: row.size, quantity: row.quantity }));
}

export async function addDiaperStock(input: {
  childId: string;
  brand: string | null;
  model: string | null;
  size: string | null;
  quantity: number;
  createdBy?: string | null;
}): Promise<{ id: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("diaper_stock")
    .insert({
      child_id: input.childId,
      brand: input.brand,
      model: input.model,
      size: input.size,
      quantity: input.quantity,
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to add diaper stock", error);
    throw new Error("Não foi possível salvar o estoque.");
  }

  return { id: data.id };
}

export async function updateDiaperStockQuantity(input: { id: string; childId: string; quantity: number }): Promise<void> {
  const supabase = createServiceClient();
  const { data: existing } = await supabase.from("diaper_stock").select("id, child_id").eq("id", input.id).maybeSingle();
  if (!existing || existing.child_id !== input.childId) {
    throw new Error("Estoque não encontrado.");
  }

  const { error } = await supabase
    .from("diaper_stock")
    .update({ quantity: input.quantity, updated_at: new Date().toISOString() })
    .eq("id", input.id);

  if (error) {
    console.error("Failed to update diaper stock", error);
    throw new Error("Não foi possível atualizar o estoque.");
  }
}

export async function deleteDiaperStock(id: string, childId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: existing } = await supabase.from("diaper_stock").select("id, child_id").eq("id", id).maybeSingle();
  if (!existing || existing.child_id !== childId) {
    throw new Error("Estoque não encontrado.");
  }

  const { error } = await supabase.from("diaper_stock").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete diaper stock", error);
    throw new Error("Não foi possível remover.");
  }
}
