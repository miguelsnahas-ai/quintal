import { createServiceClient } from "@/lib/supabase/service";
import { parseContentFields } from "@/lib/activity";
import {
  mealSlotLabels,
  mealEventPayloadSchema,
  type MealSlot,
  type MealAcceptance,
  type MealEventPayload,
} from "@/lib/validation/feeding";
import type { EventOrigin } from "@/lib/validation/events";
import type { Json } from "@/lib/supabase/types";

// knowledge_chunks categories this module reads as reference content —
// same "activity.ts" pattern: no new content written, these already
// existed in the seeded knowledge base (see
// scripts/knowledge-base/sync_knowledge_base.py's CONFIGS).
const FEEDING_METHOD_CATEGORY = "metodos_alimentacao"; // 5 rows: Tradicional, BLW, BLISS, Participativa/mista, Responsiva
const RECIPE_CATEGORY = "receitas"; // 60 rows

const MEAL_SUGGESTIONS_LIMIT = 6;
const MEAL_HISTORY_LIMIT = 30;

// ---------------------------------------------------------------------
// Registro de refeições — events.type = 'meal' (Fase 8) + payload
// estruturado (Fase 9). Ver docs/ARCHITECTURE_TARGET.md, "Módulo de
// Alimentação (Fase 9)".
// ---------------------------------------------------------------------

// Small UX touch for the quick-log form's default selection — never
// required to be accurate, the family can always change it; just saves a
// tap in the common case. Boundaries are approximate on purpose (no
// per-family routine data to base this on yet).
export function guessMealSlot(hour: number): MealSlot {
  if (hour < 10) return "breakfast";
  if (hour < 11) return "morning_snack";
  if (hour < 14) return "lunch";
  if (hour < 17) return "afternoon_snack";
  if (hour < 20) return "dinner";
  return "other";
}

export type MealHistoryEntry = {
  id: string;
  occurredAt: string;
  slot: MealSlot;
  foods: string[];
  acceptance: MealAcceptance;
  notes: string;
};

// The single choke point for creating a meal event — called today only
// by the quick-log form's server action (origin: 'manual'), but built so
// a future chat-based extractor is just another caller passing
// origin: 'chat' and a sourceMessageId, with no schema or logic change.
// This IS the "infraestrutura para o chat atualizar registros no futuro"
// asked for this phase — not a parser, just the one place that already
// knows how to turn a meal into a valid events row, ready for something
// else to call it.
export async function recordMealEvent(input: {
  childId: string;
  occurredAt: string;
  slot: MealSlot;
  foods: string[];
  acceptance: MealAcceptance;
  notes: string | null;
  offeringMethodId: string | null;
  suggestionId: string | null;
  origin: EventOrigin;
  sourceMessageId?: string | null;
}): Promise<{ id: string }> {
  const supabase = createServiceClient();

  const payload: MealEventPayload = {
    slot: input.slot,
    foods: input.foods,
    acceptance: input.acceptance,
    offeringMethodId: input.offeringMethodId,
    suggestionId: input.suggestionId,
  };

  // events.notes is NOT NULL — a quick log with no typed observation
  // still needs something honest there; falling back to the foods list
  // (or the slot name, if even that's empty) beats forcing the family to
  // type a redundant sentence just to satisfy the column.
  const notes =
    input.notes?.trim() ||
    (input.foods.length > 0 ? input.foods.join(", ") : mealSlotLabels[input.slot]);

  const { data, error } = await supabase
    .from("events")
    .insert({
      child_id: input.childId,
      type: "meal",
      occurred_at: input.occurredAt,
      notes,
      payload: payload as unknown as Json,
      origin: input.origin,
      source_message_id: input.sourceMessageId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to record meal event", error);
    throw new Error("Não foi possível registrar a refeição.");
  }

  return { id: data.id };
}

function parseMealPayload(payload: Json): MealEventPayload | null {
  const parsed = mealEventPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

// Most recent first — the page groups these into "Hoje"/"Ontem"/etc.
// Malformed/legacy payloads (shouldn't happen, but payload is untyped
// jsonb) fall back to slot "other" and empty foods rather than dropping
// the row — the family still logged something, and `notes` always has
// the real text either way.
export async function getMealHistory(childId: string, limit = MEAL_HISTORY_LIMIT): Promise<MealHistoryEntry[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("events")
    .select("id, occurred_at, notes, payload")
    .eq("child_id", childId)
    .eq("type", "meal")
    .order("occurred_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const payload = parseMealPayload(row.payload);
    return {
      id: row.id,
      occurredAt: row.occurred_at,
      slot: payload?.slot ?? "other",
      foods: payload?.foods ?? [],
      acceptance: payload?.acceptance ?? "unknown",
      notes: row.notes,
    };
  });
}

// ---------------------------------------------------------------------
// Método alimentar — uma referência a knowledge_chunks, não um enum
// hardcoded (ver a migração desta fase). "A escolha pertence à família":
// nenhuma opção é marcada como recomendada ou padrão.
// ---------------------------------------------------------------------

export type FeedingMethodOption = {
  id: string;
  title: string;
  howItWorks: string | null;
};

export async function getFeedingMethodOptions(): Promise<FeedingMethodOption[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("knowledge_chunks")
    .select("id, title, content")
    .eq("category", FEEDING_METHOD_CATEGORY)
    .order("id", { ascending: true });

  return (data ?? []).map((row) => {
    const fields = parseContentFields(row.content);
    return {
      id: row.id,
      title: row.title,
      howItWorks: fields.get("Como funciona") ?? null,
    };
  });
}

export type ChildFeedingMethod = {
  // Exactly one of these is non-null once the family has configured
  // something; both null means "not configured yet".
  option: FeedingMethodOption | null;
  custom: string | null;
};

export async function getChildFeedingMethod(childId: string): Promise<ChildFeedingMethod> {
  const supabase = createServiceClient();
  const { data: child } = await supabase
    .from("children")
    .select("feeding_method_id, feeding_method_custom")
    .eq("id", childId)
    .maybeSingle();

  if (!child?.feeding_method_id) {
    return { option: null, custom: child?.feeding_method_custom ?? null };
  }

  const { data: row } = await supabase
    .from("knowledge_chunks")
    .select("id, title, content")
    .eq("id", child.feeding_method_id)
    .eq("category", FEEDING_METHOD_CATEGORY)
    .maybeSingle();

  if (!row) {
    return { option: null, custom: child.feeding_method_custom };
  }

  const fields = parseContentFields(row.content);
  return {
    option: { id: row.id, title: row.title, howItWorks: fields.get("Como funciona") ?? null },
    custom: null,
  };
}

export async function updateChildFeedingMethod(
  childId: string,
  input: { methodId: string | null; methodCustom: string | null },
): Promise<void> {
  const supabase = createServiceClient();
  // A listed method and a custom description are mutually exclusive by
  // construction — picking one clears the other, so the page never has
  // to reconcile two "current method" answers at once.
  const { error } = await supabase
    .from("children")
    .update({
      feeding_method_id: input.methodId,
      feeding_method_custom: input.methodId ? null : input.methodCustom,
    })
    .eq("id", childId);

  if (error) {
    throw new Error(error.message);
  }
}

// ---------------------------------------------------------------------
// Sugestões de refeição — a partir das receitas já existentes em
// knowledge_chunks (categoria "receitas"). Regra simples e transparente,
// sem scoring, mesmo espírito de decideActivity
// (src/lib/recommendation.ts): filtra por idade, prioriza o que cita o
// método da família no texto, mantém a ordem natural como desempate.
// Estruturada para uma futura camada de recomendação assumir o lugar
// desta função sem mudar o formato de MealSuggestion nem os call sites
// (a mesma forma que recommendActivity assumiu de suggestReply — ver
// Fase 5).
// ---------------------------------------------------------------------

export type MealSuggestion = {
  id: string;
  title: string;
  mealLabel: string | null; // "Almoço/jantar", verbatim da planilha
  ageMinMonths: number | null;
  compatibleMethods: string[]; // ex.: ["BLW", "BLISS", "Mista"], verbatim
  ingredients: string | null;
  howTo: string | null;
  note: string | null; // orientação de textura/segurança já presente na receita
};

type RecipeRow = {
  id: string;
  title: string;
  age_min_months: number | null;
  content: string;
};

function toMealSuggestion(row: RecipeRow): MealSuggestion {
  const fields = parseContentFields(row.content);
  const methodsRaw = fields.get("Métodos compatíveis") ?? "";
  return {
    id: row.id,
    title: row.title,
    mealLabel: fields.get("Refeição") ?? null,
    ageMinMonths: row.age_min_months,
    compatibleMethods: methodsRaw
      .split(";")
      .map((method) => method.trim())
      .filter(Boolean),
    ingredients: fields.get("Ingredientes") ?? null,
    howTo: fields.get("Modo de preparo") ?? null,
    note: fields.get("Observação") ?? null,
  };
}

const SLOT_LABEL_KEYWORDS: Partial<Record<MealSlot, string[]>> = {
  breakfast: ["café da manhã"],
  lunch: ["almoço"],
  dinner: ["jantar"],
  morning_snack: ["lanche"],
  afternoon_snack: ["lanche"],
};

function slotMatchesRecipe(slot: MealSlot, mealLabel: string | null): boolean {
  const keywords = SLOT_LABEL_KEYWORDS[slot];
  if (!keywords || !mealLabel) return false;
  const normalized = mealLabel.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

// A receita fala em siglas curtas ("BLW", "BLISS", "Tradicional",
// "Mista") — o método configurado pela família tem um título mais longo
// ("BLW (Baby-Led Weaning)"). Reduz o título a essa palavra-chave para
// comparar com "Métodos compatíveis" sem reescrever nenhum dos dois
// textos originais. Exportada (Fase 12) para library.ts reaproveitar a
// mesma heurística ao decidir se um material de alimentação "combina"
// com o método da família, em vez de duplicar a lista de sinônimos.
export function methodKeyword(methodTitle: string): string | null {
  const normalized = methodTitle.toLowerCase();
  if (normalized.includes("bliss")) return "bliss";
  if (normalized.includes("blw")) return "blw";
  if (normalized.includes("tradicional")) return "tradicional";
  if (normalized.includes("mista") || normalized.includes("participativa")) return "mista";
  return null;
}

export async function getMealSuggestions(input: {
  ageMonths: number | null;
  slot?: MealSlot;
  feedingMethodTitle?: string | null;
}): Promise<MealSuggestion[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("knowledge_chunks")
    .select("id, title, age_min_months, content")
    .eq("category", RECIPE_CATEGORY)
    .order("id", { ascending: true });

  const ageAppropriate = (data ?? [])
    .filter((row) => row.age_min_months === null || input.ageMonths === null || row.age_min_months <= input.ageMonths)
    .map(toMealSuggestion);

  const slotFiltered = input.slot ? ageAppropriate.filter((s) => slotMatchesRecipe(input.slot!, s.mealLabel)) : [];
  const pool = slotFiltered.length > 0 ? slotFiltered : ageAppropriate;

  const keyword = input.feedingMethodTitle ? methodKeyword(input.feedingMethodTitle) : null;
  const ordered = keyword
    ? [...pool].sort((a, b) => {
        const aMatches = a.compatibleMethods.some((m) => m.toLowerCase().includes(keyword)) ? 0 : 1;
        const bMatches = b.compatibleMethods.some((m) => m.toLowerCase().includes(keyword)) ? 0 : 1;
        return aMatches - bMatches;
      })
    : pool;

  return ordered.slice(0, MEAL_SUGGESTIONS_LIMIT);
}
