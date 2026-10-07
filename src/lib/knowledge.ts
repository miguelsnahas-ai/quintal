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
//
// Delegates the actual matching to the search_knowledge_chunks() SQL
// function (see supabase/migrations/20260924193755_*) rather than building
// a PostgREST .textSearch()/.or() query here: getting this right needed an
// IDF-weighted OR match plus title/category bonuses and a soft (not hard)
// age filter — see that migration's comment for why the naive version
// (websearch_to_tsquery + a hard age range filter) returned nothing for
// realistic messages.
export async function searchKnowledge(input: {
  query: string;
  ageMonths: number | null;
  limit?: number;
}): Promise<KnowledgeChunk[]> {
  const query = input.query.trim();
  if (!query) return [];

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("search_knowledge_chunks", {
    message: query,
    age_months: input.ageMonths ?? undefined,
    result_limit: input.limit ?? 6,
  });

  if (error) {
    console.error("searchKnowledge failed", error);
    return [];
  }

  return data ?? [];
}
