import { createServiceClient } from "@/lib/supabase/service";

export type KnowledgeChunk = {
  id: string;
  category: string;
  title: string;
  content: string;
};

// Read-only reference data (materiais, brincadeiras, alimentos, receitas,
// rotinas de sono, desenvolvimento, higiene, passeios etc.) seeded once via
// migration — same "always use the service client, it's not per-family"
// pattern as ai-settings.ts, so this works from every call site
// (authenticated playground, public /test chat, inbox triage) without
// threading a Supabase client through suggestReply's callers.
export async function searchKnowledge(input: {
  query: string;
  ageMonths: number | null;
  limit?: number;
}): Promise<KnowledgeChunk[]> {
  const query = input.query.trim();
  if (!query) return [];

  const supabase = createServiceClient();
  let request = supabase
    .from("knowledge_chunks")
    .select("id, category, title, content")
    .textSearch("search", query, { type: "websearch", config: "portuguese" })
    .limit(input.limit ?? 5);

  if (input.ageMonths !== null) {
    request = request
      .or(`age_min_months.is.null,age_min_months.lte.${input.ageMonths}`)
      .or(`age_max_months.is.null,age_max_months.gte.${input.ageMonths}`);
  }

  const { data, error } = await request;
  if (error) {
    console.error("searchKnowledge failed", error);
    return [];
  }

  return data ?? [];
}
