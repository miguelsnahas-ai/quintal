import { createServiceClient } from "@/lib/supabase/service";
import {
  getActivity,
  toActivity,
  toActivitySummary,
  type Activity,
  type ActivitySummary,
  type ActivityEnvironment,
  type KnowledgeChunkRow,
} from "@/lib/activity";
import { playEventPayloadSchema, activityFeedbackLabels, type ActivityFeedback, type PlayEventPayload } from "@/lib/validation/play";
import type { EventOrigin } from "@/lib/validation/events";
import type { Json } from "@/lib/supabase/types";

const SUGGESTIONS_LIMIT = 3; // "Para hoje" — um punhado curado, não a biblioteca inteira
// Biblioteca completa, sem paginação nesta fase (ver limitações) — 200 é
// uma folga confortável acima do total real de brincadeiras+materiais
// hoje (84 + 65 = 149, conferido direto no banco), não um número
// arbitrário; se o conteúdo crescer muito além disso, este é o primeiro
// lugar a precisar de paginação de verdade.
const LIBRARY_LIMIT = 200;
const HISTORY_LIMIT = 30;
const RECENT_NEGATIVE_LIBRARY_FEEDBACK_LIMIT = 5;

// ---------------------------------------------------------------------
// Registro + feedback de atividades — events.type = 'free_play' (já
// existia desde a Fase 3) + payload estruturado (Fase 11), mesmo padrão
// já usado por meal (Fase 9) e sleep (Fase 10): nenhuma tabela nova,
// nenhuma migração nesta fase. Ver docs/ARCHITECTURE_TARGET.md, "Módulo
// de Brincadeiras (Fase 11)".
// ---------------------------------------------------------------------

// O único ponto que grava um registro de atividade — "registro" e
// "feedback" pedidos como critérios separados chegam juntos aqui, mesmo
// espírito de logMeal (Fase 9) combinar "o que foi oferecido" e
// "aceitação" num só passo em vez de dois. Chamado hoje só pelo
// formulário manual em /atividades/[id] (origin: 'manual'); uma futura
// extração do chat seria só mais um chamador com origin: 'chat'.
export async function logActivityOutcome(input: {
  childId: string;
  activityId: string;
  feedback: ActivityFeedback;
  occurredAt?: string;
  origin: EventOrigin;
  sourceMessageId?: string | null;
  caregiverId?: string | null;
}): Promise<{ id: string }> {
  const supabase = createServiceClient();

  const activity = await getActivity(input.activityId);
  if (!activity) {
    throw new Error("Atividade não encontrada.");
  }

  const payload: PlayEventPayload = {
    activityId: input.activityId,
    activityTitle: activity.title,
    feedback: input.feedback,
  };
  const notes = `${activity.title} — ${activityFeedbackLabels[input.feedback]}`;

  const { data, error } = await supabase
    .from("events")
    .insert({
      child_id: input.childId,
      type: "free_play",
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      notes,
      payload: payload as unknown as Json,
      origin: input.origin,
      source_message_id: input.sourceMessageId ?? null,
      caregiver_id: input.caregiverId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to log activity outcome", error);
    throw new Error("Não foi possível registrar.");
  }

  return { id: data.id };
}

// Segundo ponto de gravação de 'free_play' (Fase 15) — deliberadamente
// separado de logActivityOutcome acima, não uma variante dele: aquele é
// o fluxo da Biblioteca, onde activityId (uma atividade catalogada) e
// feedback (a pergunta "Como foi?") são sempre obrigatórios por design
// de produto. O chat descreve brincadeiras em texto livre
// ("empilhamos blocos, 20 min") que nem sempre bate com o catálogo e nem
// sempre vem com uma reação explícita — forçar os dois campos aqui
// inventaria dado que a família não disse. Grava o mesmo events.type =
// 'free_play', só que com activityId/feedback nullable (ver
// src/lib/validation/play.ts) e duration_minutes (a mesma coluna
// genérica que sleep.ts já usa, nunca específica de sono).
export async function recordPlayEvent(input: {
  childId: string;
  activityTitle: string;
  activityId?: string | null;
  feedback?: ActivityFeedback | null;
  durationMinutes?: number | null;
  occurredAt?: string;
  origin: EventOrigin;
  sourceMessageId?: string | null;
  caregiverId?: string | null;
}): Promise<{ id: string }> {
  const supabase = createServiceClient();

  const activityId = input.activityId ?? null;
  const feedback = input.feedback ?? null;

  const payload: PlayEventPayload = {
    activityId,
    activityTitle: input.activityTitle,
    feedback,
  };
  const notes = feedback ? `${input.activityTitle} — ${activityFeedbackLabels[feedback]}` : input.activityTitle;

  const { data, error } = await supabase
    .from("events")
    .insert({
      child_id: input.childId,
      type: "free_play",
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      notes,
      payload: payload as unknown as Json,
      duration_minutes: input.durationMinutes ?? null,
      origin: input.origin,
      source_message_id: input.sourceMessageId ?? null,
      caregiver_id: input.caregiverId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to record play event", error);
    throw new Error("Não foi possível registrar a brincadeira.");
  }

  return { id: data.id };
}

export type ActivityHistoryEntry = {
  id: string;
  occurredAt: string;
  activityId: string | null;
  activityTitle: string | null;
  feedback: ActivityFeedback | null;
  notes: string;
};

function parsePlayPayload(payload: Json): PlayEventPayload | null {
  const parsed = playEventPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

// Mais recente primeiro — mesmo padrão de getMealHistory/getSleepHistory.
// activityTitle vem do próprio payload (gravado no momento do registro,
// ver logActivityOutcome acima), nunca de uma segunda consulta — por
// isso não há N+1 aqui, diferente de dashboard.ts's recommendedActivities.
export async function getActivityHistory(childId: string, limit = HISTORY_LIMIT): Promise<ActivityHistoryEntry[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("events")
    .select("id, occurred_at, notes, payload")
    .eq("child_id", childId)
    .eq("type", "free_play")
    .order("occurred_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const payload = parsePlayPayload(row.payload);
    return {
      id: row.id,
      occurredAt: row.occurred_at,
      activityId: payload?.activityId ?? null,
      activityTitle: payload?.activityTitle ?? null,
      feedback: payload?.feedback ?? null,
      notes: row.notes,
    };
  });
}

// Mesmo espírito de getRecentNegativeFeedbackActivityIds
// (src/lib/recommendation.ts, Fase 6), mas lendo o sinal que vem da
// biblioteca (events.payload) em vez de activity_recommendation_feedback.
// recommendation.ts importa esta função para que uma reação negativa
// registrada aqui também influencie recomendações futuras no chat — uma
// única direção de dependência (recommendation.ts → play.ts), sem ciclo.
// A volta (recomendações do chat influenciando a biblioteca) fica para
// uma fase futura, ver limitações.
export async function getRecentNegativeLibraryFeedbackActivityIds(childId: string): Promise<Set<string>> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("events")
    .select("payload")
    .eq("child_id", childId)
    .eq("type", "free_play")
    .not("payload->>activityId", "is", null)
    .in("payload->>feedback", ["not_interested", "did_not_do"])
    .order("occurred_at", { ascending: false })
    .limit(RECENT_NEGATIVE_LIBRARY_FEEDBACK_LIMIT);

  // O filtro .not("payload->>activityId", "is", null) já garante isso em
  // SQL — o .filter abaixo só repete a garantia no nível de tipos, já
  // que activityId é nullable desde a Fase 15 (registros livres do chat).
  const ids = (data ?? [])
    .map((row) => parsePlayPayload(row.payload))
    .filter((payload): payload is PlayEventPayload & { activityId: string } => payload?.activityId != null)
    .map((payload) => payload.activityId);

  return new Set(ids);
}

// ---------------------------------------------------------------------
// Filtros — idade (idade sempre obrigatória, nunca um filtro que a
// família liga/desliga, mesmo raciocínio de segurança de decideActivity
// em recommendation.ts), interesses, ambiente, tempo disponível,
// materiais disponíveis. Regra simples e transparente, sem scoring: cada
// filtro só EXCLUI quando tem certeza; na ausência de dado (duração não
// informada, atividade sem lista de materiais...) a atividade nunca é
// descartada só por falta de informação. Estruturada para uma futura
// camada de recomendação assumir o lugar sem mudar ActivitySummary nem
// os call sites — mesma forma que getMealSuggestions (Fase 9) e
// decideActivity (Fase 5) já validaram.
// ---------------------------------------------------------------------

export type ActivityFilterInput = {
  ageMonths: number | null;
  interests?: string[];
  environment?: Extract<ActivityEnvironment, "home" | "outdoor">;
  maxMinutes?: number | null;
  availableMaterials?: string[];
  excludeIds?: Set<string>;
};

function isAgeAppropriate(activity: Activity, ageMonths: number | null): boolean {
  if (ageMonths === null) return true;
  if (activity.ageMinMonths !== null && ageMonths < activity.ageMinMonths) return false;
  if (activity.ageMaxMonths !== null && ageMonths > activity.ageMaxMonths) return false;
  return true;
}

function matchesEnvironment(activity: Activity, filter?: "home" | "outdoor"): boolean {
  if (!filter) return true;
  if (activity.environment === "both") return true; // ambiente flexível, nunca excluída
  return activity.environment === filter;
}

function matchesMaxMinutes(activity: Activity, maxMinutes?: number | null): boolean {
  if (!maxMinutes) return true;
  if (activity.estimatedMinutes === null) return true; // duração não informada — nunca exclui por falta de dado
  return activity.estimatedMinutes <= maxMinutes;
}

function matchesMaterials(activity: Activity, availableMaterials?: string[]): boolean {
  if (!availableMaterials || availableMaterials.length === 0) return true;
  if (!activity.materials) return true; // sem lista de materiais — nunca exclui
  const normalized = activity.materials.toLowerCase();
  if (normalized.includes("nenhum")) return true; // não precisa de nada
  return availableMaterials.some((material) => normalized.includes(material.toLowerCase().trim()));
}

function matchesInterests(activity: Activity, interests?: string[]): boolean {
  if (!interests || interests.length === 0) return true;
  const haystack = [activity.title, activity.why, ...activity.tags].filter(Boolean).join(" ").toLowerCase();
  return interests.some((interest) => interest.trim() && haystack.includes(interest.toLowerCase().trim()));
}

async function getActivityCandidates(): Promise<Activity[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("knowledge_chunks")
    .select("id, category, title, age_min_months, age_max_months, tags, content, image_url")
    .in("category", ["brincadeiras", "materiais"])
    .eq("status", "published")
    .order("id", { ascending: true });

  return (data ?? [])
    .map((row) => toActivity(row as KnowledgeChunkRow))
    .filter((activity): activity is Activity => activity !== null);
}

// `limit` deixa a mesma função servir tanto "Para hoje" (poucas, curadas)
// quanto a biblioteca completa filtrada — só muda quantas linhas voltam,
// nunca a regra de filtro em si.
export async function getActivitySuggestions(
  input: ActivityFilterInput,
  limit = SUGGESTIONS_LIMIT,
): Promise<ActivitySummary[]> {
  const activities = await getActivityCandidates();

  const ageAppropriate = activities.filter((activity) => isAgeAppropriate(activity, input.ageMonths));

  const filtered = ageAppropriate.filter(
    (activity) =>
      !input.excludeIds?.has(activity.id) &&
      matchesEnvironment(activity, input.environment) &&
      matchesMaxMinutes(activity, input.maxMinutes) &&
      matchesMaterials(activity, input.availableMaterials),
  );

  // Interesses é um desempate/preferência, não um filtro duro: se ele
  // zerar a lista, cai de volta no pool sem esse critério — melhor
  // sugerir algo adequado do que nada, mesmo raciocínio de
  // getMealSuggestions (Fase 9) para o filtro de refeição do dia.
  const withInterests = filtered.filter((activity) => matchesInterests(activity, input.interests));
  const pool = withInterests.length > 0 ? withInterests : filtered;

  return pool.slice(0, limit).map(toActivitySummary);
}

export async function getLibraryActivities(input: ActivityFilterInput): Promise<ActivitySummary[]> {
  return getActivitySuggestions(input, LIBRARY_LIMIT);
}
