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

// Same idea, but for negative feedback specifically (Fase 6): how many of
// a child's most recent "did_not_work"/"wants_another" feedback entries
// count toward avoiding that activity again soon. Deliberately a small
// COUNT, not a permanent exclusion — see the "não inferir preferências
// permanentes" note on getActivityIdsToAvoidForNow below.
const RECENT_NEGATIVE_FEEDBACK_LIMIT = 5;

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
  | { kind: "activity"; activity: ActivitySummary; reason: string; recommendationId: string }
  | { kind: "clarify"; question: string }
  | { kind: "none" };

// The three feedback values a family can give about a recommendation
// (Fase 6). "wants_another" is grouped with "did_not_work" for the
// repetition-avoidance rule below — both mean "not this one, not now" —
// but is kept as its own value (rather than reusing did_not_work) so ops
// can still tell the two apart: one is "this didn't land", the other is
// just "give me a different option right now", not necessarily a
// judgment on the activity itself.
export const RECOMMENDATION_FEEDBACK_VALUES = ["worked", "did_not_work", "wants_another"] as const;
export type RecommendationFeedback = (typeof RECOMMENDATION_FEEDBACK_VALUES)[number];

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
  // The inbound message that triggered this turn — stored on the
  // recommendation row (source_message_id) purely for traceability in
  // /ops (Concierge can see which message led to which suggestion). Never
  // read back by the decision logic itself.
  sourceMessageId: string | null;
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

  const recommendationId = await recordRecommendation(
    childContext.child.id,
    decision.id,
    input.sourceMessageId,
  );

  return { kind: "activity", activity: toActivitySummary(decision), reason, recommendationId };
}

// DECISÃO — regra simples e transparente, sem ranking/scoring (por
// pedido explícito desta fase):
//   1. Busca por relevância textual (search_knowledge_chunks, já ordenado
//      por relevância pela própria função SQL), restrita às categorias
//      que de fato viram "Activity" (brincadeiras/materiais).
//   2. Descarta o que não é etariamente seguro para ESTA criança —
//      filtro obrigatório (segurança), não uma preferência, nunca
//      flexibilizado pelo que vem a seguir.
//   3. Descarta o que deve ser "evitado por enquanto" para ELA (não para
//      a família nem para um irmão): recomendado recentemente OU com
//      feedback negativo recente (Fase 6 — ver getActivityIdsToAvoidForNow).
//   4. O primeiro que sobrar (ou seja, o mais relevante da busca que
//      passou nos filtros) é a decisão. Se o filtro do passo 3 zerar tudo
//      mas ainda houver opções etariamente seguras, repete a mais
//      relevante mesmo assim — melhor sugerir de novo do que não sugerir
//      nada; a idade nunca é flexibilizada da mesma forma.
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

  const avoidForNowIds = await getActivityIdsToAvoidForNow(childId);
  const notAvoided = ageAppropriate.filter((activity) => !avoidForNowIds.has(activity.id));

  return notAvoided[0] ?? ageAppropriate[0];
}

function isAgeAppropriate(activity: Activity, childAgeMonths: number): boolean {
  if (activity.ageMinMonths !== null && childAgeMonths < activity.ageMinMonths) return false;
  if (activity.ageMaxMonths !== null && childAgeMonths > activity.ageMaxMonths) return false;
  return true;
}

// Union of two "give it a rest" signals, both scoped to this child only:
// activities recommended in the last RECENT_RECOMMENDATIONS_LIMIT turns
// (regardless of feedback — don't repeat the exact same suggestion back
// to back), and activities whose most recent feedback among the last
// RECENT_NEGATIVE_FEEDBACK_LIMIT entries was "did_not_work"/
// "wants_another". Both are small, count-bounded windows, never a
// permanent exclusion — see the module-level note on
// RECOMMENDATION_FEEDBACK_VALUES and the "não inferir preferências
// permanentes" requirement: a single "não funcionou" delays this
// activity, it does not blacklist it. decideActivity still falls back to
// recommending it again if nothing else survives the age-safety filter.
async function getActivityIdsToAvoidForNow(childId: string): Promise<Set<string>> {
  const [recentlyRecommendedIds, recentNegativeFeedbackIds] = await Promise.all([
    getRecentlyRecommendedIds(childId),
    getRecentNegativeFeedbackActivityIds(childId),
  ]);
  return new Set([...recentlyRecommendedIds, ...recentNegativeFeedbackIds]);
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

async function getRecentNegativeFeedbackActivityIds(childId: string): Promise<Set<string>> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("activity_recommendation_feedback")
    .select("activity_id")
    .eq("child_id", childId)
    .in("feedback", ["did_not_work", "wants_another"] satisfies RecommendationFeedback[])
    .order("created_at", { ascending: false })
    .limit(RECENT_NEGATIVE_FEEDBACK_LIMIT);

  return new Set((data ?? []).map((row) => row.activity_id));
}

// Returns the new recommendation's id — needed so the UI can attach
// feedback (submitRecommendationFeedback) and an "opened" event
// (markRecommendationOpened) to this exact occurrence, not just "this
// activity" in the abstract (the same activity can be recommended to the
// same child more than once, each time as its own row).
async function recordRecommendation(
  childId: string,
  activityId: string,
  sourceMessageId: string | null,
): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("activity_recommendations")
    .insert({ child_id: childId, activity_id: activityId, source_message_id: sourceMessageId })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to record activity recommendation", error);
    throw new Error("Não foi possível registrar a recomendação.");
  }

  return data.id;
}

// The decision (which activity) is already final by the time redação
// could fail — losing the LLM call shouldn't lose the recommendation
// itself, just the quality of its phrasing.
function defaultReason(activity: Activity): string {
  return `Que tal ${activity.title.toLowerCase()}? Pode ser uma boa ideia para agora.`;
}

// RECOMMENDATION_FEEDBACK — deliberately its own table
// (activity_recommendation_feedback), never a column overwritten on
// activity_recommendations: the original recommendation (what was
// suggested, when, from which message) stays exactly as recorded,
// forever; feedback is additional, later information about how it went.
// A recommendation can even receive more than one feedback row over time
// without ever touching the recommendation itself.
export async function submitRecommendationFeedback(input: {
  recommendationId: string;
  feedback: RecommendationFeedback;
  note?: string | null;
}): Promise<void> {
  const supabase = createServiceClient();

  const { data: recommendation, error: recommendationError } = await supabase
    .from("activity_recommendations")
    .select("child_id, activity_id")
    .eq("id", input.recommendationId)
    .maybeSingle();

  if (recommendationError || !recommendation) {
    throw new Error("Recomendação não encontrada.");
  }

  const note = input.note?.trim();
  const { error } = await supabase.from("activity_recommendation_feedback").insert({
    recommendation_id: input.recommendationId,
    child_id: recommendation.child_id,
    activity_id: recommendation.activity_id,
    feedback: input.feedback,
    note: note ? note : null,
  });

  if (error) {
    console.error("Failed to record recommendation feedback", error);
    throw new Error("Não foi possível registrar o feedback.");
  }
}

// "recommendation_opened" — set once, the first time the family actually
// opens the activity from this specific recommendation (see
// /atividades/[id]'s ?rec= param). `.is("opened_at", null)` makes this a
// no-op on a second visit, so the timestamp always reflects the first
// open, not the latest.
export async function markRecommendationOpened(recommendationId: string, activityId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("activity_recommendations")
    .update({ opened_at: new Date().toISOString() })
    .eq("id", recommendationId)
    .eq("activity_id", activityId)
    .is("opened_at", null);
}
