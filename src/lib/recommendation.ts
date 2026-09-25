import { createServiceClient } from "@/lib/supabase/service";
import { searchKnowledge } from "@/lib/knowledge";
import { detectActivityRequest } from "@/lib/groq/detectActivityRequest";
import { explainRecommendation } from "@/lib/groq/explainRecommendation";
import {
  getActivity,
  isActivityCategory,
  toActivitySummary,
  type Activity,
  type ActivitySummary,
} from "@/lib/activity";
import type { ChildContext } from "@/lib/childContext";

// How many of a child's most recent recommendations count as "just
// recommended" for the purposes of not repeating — a count, not a time
// window, same deterministic-limit style as ChildContext's own limits
// (src/lib/childContext.ts). Scoped per child (activity_recommendations.
// child_id), never per family, so a sibling's recommendations never block
// this child's — same isolation principle as ChildContext itself.
const RECENT_RECOMMENDATIONS_LIMIT = 5;

// How many knowledge_chunks candidates to pull before filtering down to
// brincadeiras/materiais — generous because most of a default 6-result
// search may not even be an "activity" category, and a few more get
// dropped by the age/repetition filters below.
const CANDIDATE_SEARCH_LIMIT = 8;

// Fixed, not LLM-generated — asking a *question* instead of a
// recommendation is exactly the "don't invent preferences" case, so the
// question itself shouldn't be invented either. Generic and safe on
// purpose: it never assumes an age, a interest, or a material the family
// hasn't told us about.
const GENERIC_CLARIFYING_QUESTION =
  "Me conta um pouco mais: ela prefere algo mais calmo ou de se mexer agora? E tem algum material simples à mão (potes, papelão, tecidos, giz de cera)?";

export type RecommendationResult =
  | { kind: "activity"; activity: ActivitySummary; reason: string }
  | { kind: "clarify"; question: string }
  | { kind: "none" };

// The Recommendation Engine's single entry point (see
// docs/ARCHITECTURE_TARGET.md, "Recommendation Engine (Fase 5)"). Kept
// deliberately separate from suggestReply: suggestReply only writes the
// general conversational reply for turns that AREN'T an activity
// recommendation; this owns the entire "does this situation call for a
// recommendation, and if so which one" pipeline end to end, including
// deciding, explaining and recording it.
export async function recommendActivity(input: {
  childContext: ChildContext | null;
  situation: string;
  recentConversation: { direction: string; body: string }[];
}): Promise<RecommendationResult> {
  // No identified child means no age to safety-check against and no
  // per-child recommendation history to consult — recommending blind
  // would violate the "never recommend age-incompatible content" rule by
  // construction, so this path is a deliberate "none", not a best-effort
  // guess. See docs/ARCHITECTURE_TARGET.md limitations.
  if (!input.childContext || input.childContext.age.months === null) {
    return { kind: "none" };
  }
  const childContext = input.childContext;
  const ageMonths = childContext.age.months as number;

  const detection = await detectActivityRequest({
    messageBody: input.situation,
    recentMessages: input.recentConversation,
  }).catch(() => null);

  if (!detection?.wantsActivitySuggestion) {
    return { kind: "none" };
  }

  const decision = await decideActivity(childContext.child.id, ageMonths, detection.situationSummary);

  if (!decision) {
    return { kind: "clarify", question: GENERIC_CLARIFYING_QUESTION };
  }

  const reason = await explainRecommendation({
    activity: decision,
    situationSummary: detection.situationSummary,
    childContext,
  }).catch(() => defaultReason(decision));

  await recordRecommendation(childContext.child.id, decision.id);

  return { kind: "activity", activity: toActivitySummary(decision), reason };
}

// DECISÃO — regra simples e transparente, sem ranking/scoring (por
// pedido explícito desta fase):
//   1. Busca por relevância textual (search_knowledge_chunks, já ordenado
//      por relevância pela própria função SQL), restrita às categorias
//      que de fato viram "Activity" (brincadeiras/materiais).
//   2. Descarta o que não é etariamente seguro para ESTA criança —
//      filtro obrigatório (segurança), não uma preferência.
//   3. Descarta o que foi recomendado recentemente para ELA (não para a
//      família nem para um irmão — ver activity_recommendations).
//   4. O primeiro que sobrar (ou seja, o mais relevante da busca que
//      passou nos dois filtros) é a decisão. Se o filtro de repetição
//      zerar tudo mas ainda houver opções etariamente seguras, repete a
//      mais relevante mesmo assim — melhor sugerir de novo do que não
//      sugerir nada; a idade nunca é flexibilizada da mesma forma.
async function decideActivity(
  childId: string,
  childAgeMonths: number,
  situationSummary: string,
): Promise<Activity | null> {
  const chunks = await searchKnowledge({
    query: situationSummary,
    ageMonths: childAgeMonths,
    limit: CANDIDATE_SEARCH_LIMIT,
  });

  const activityChunkIds = chunks.filter((chunk) => isActivityCategory(chunk.category)).map((chunk) => chunk.id);
  if (activityChunkIds.length === 0) return null;

  // getActivity re-fetches each candidate (it's the only place that knows
  // how to parse content back into age bounds) — a handful of extra
  // round trips per turn, acceptable for a candidate list this small;
  // not worth widening search_knowledge_chunks's own return shape for
  // this first version.
  const activities = (await Promise.all(activityChunkIds.map((id) => getActivity(id)))).filter(
    (activity): activity is Activity => activity !== null,
  );

  const ageAppropriate = activities.filter((activity) => isAgeAppropriate(activity, childAgeMonths));
  if (ageAppropriate.length === 0) return null;

  const recentlyRecommendedIds = await getRecentlyRecommendedIds(childId);
  const notRecentlyRecommended = ageAppropriate.filter(
    (activity) => !recentlyRecommendedIds.has(activity.id),
  );

  return notRecentlyRecommended[0] ?? ageAppropriate[0];
}

function isAgeAppropriate(activity: Activity, childAgeMonths: number): boolean {
  if (activity.ageMinMonths !== null && childAgeMonths < activity.ageMinMonths) return false;
  if (activity.ageMaxMonths !== null && childAgeMonths > activity.ageMaxMonths) return false;
  return true;
}

async function getRecentlyRecommendedIds(childId: string): Promise<Set<string>> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("activity_recommendations")
    .select("activity_id")
    .eq("child_id", childId)
    .order("created_at", { ascending: false })
    .limit(RECENT_RECOMMENDATIONS_LIMIT);

  return new Set((data ?? []).map((row) => row.activity_id));
}

async function recordRecommendation(childId: string, activityId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("activity_recommendations")
    .insert({ child_id: childId, activity_id: activityId });

  if (error) {
    console.error("Failed to record activity recommendation", error);
  }
}

// The decision (which activity) is already final by the time redação
// could fail — losing the LLM call shouldn't lose the recommendation
// itself, just the quality of its phrasing.
function defaultReason(activity: Activity): string {
  return `Que tal ${activity.title.toLowerCase()}? Pode ser uma boa ideia para agora.`;
}
