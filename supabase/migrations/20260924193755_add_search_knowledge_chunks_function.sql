-- RPC used by suggestReply's RAG lookup (src/lib/knowledge.ts). Plain
-- websearch_to_tsquery ANDs every term in the message, which almost never
-- matches anything on short structured chunks once the message includes
-- normal conversational filler ("posso", "meu", "pro"...). This instead:
--   1. Stems the message into individual lexemes and OR-matches them.
--   2. Weights each lexeme by IDF (rare terms like "mel" count far more
--      than common ones), computed against this table's own corpus.
--   3. Adds a bonus when a lexeme matches the chunk's title, and again
--      when it matches the chunk's category name (the sheet's own
--      "Sugestão para o RAG" said to use category as a search signal).
--   4. Treats age as a soft ranking bonus, not a hard filter — a hard
--      "age_min_months <= child_age" filter would exclude forward-looking
--      safety content like "no honey before 12 months" for an 8-month-old,
--      which is exactly the case where that content matters most.
-- Lexemes already stemmed by to_tsvector must be re-matched via
-- to_tsquery('simple', ...), not 'portuguese' — running an already-stemmed
-- token back through the Portuguese dictionary double-stems it (e.g.
-- 'brincadeir' -> 'brincad'), silently breaking the match.
create or replace function public.knowledge_chunks_tsvector(title text, content text, tags text[])
returns tsvector as $$
begin
  return to_tsvector('portuguese', title || ' ' || content || ' ' || coalesce(array_to_string(tags, ' '), ''));
end;
$$ language plpgsql immutable;

create or replace function public.search_knowledge_chunks(
  message text,
  age_months integer default null,
  result_limit integer default 6
) returns table (
  id text,
  category text,
  title text,
  content text
) as $$
  with total as (
    select count(*)::float as n from public.knowledge_chunks
  ),
  query_terms as (
    select distinct lexeme as lex
    from unnest(tsvector_to_array(to_tsvector('portuguese', message))) as lexeme
  ),
  idf_terms as (
    select qt.lex, ln(total.n / doc_freq) as idf
    from query_terms qt, total,
      lateral (select count(*) as doc_freq from public.knowledge_chunks k where k.search @@ to_tsquery('simple', qt.lex)) df
    where doc_freq > 0
  ),
  text_scored as (
    select k.id, sum(it.idf) as text_score,
      sum(case when to_tsvector('portuguese', k.title) @@ to_tsquery('simple', it.lex) then it.idf * 3 else 0 end) as title_bonus
    from public.knowledge_chunks k
    join idf_terms it on k.search @@ to_tsquery('simple', it.lex)
    group by k.id
  ),
  category_scored as (
    select k.id, count(*) * 6.0 as category_bonus
    from public.knowledge_chunks k, query_terms qt
    where to_tsvector('portuguese', replace(k.category, '_', ' ')) @@ to_tsquery('simple', qt.lex)
    group by k.id
  ),
  candidates as (
    select id from text_scored
    union
    select id from category_scored
  ),
  scored as (
    select
      k.id, k.category, k.title, k.content,
      coalesce(ts.text_score, 0) + coalesce(ts.title_bonus, 0) + coalesce(cs.category_bonus, 0) +
      case
        when age_months is null then 0
        when (k.age_min_months is null or k.age_min_months <= age_months)
         and (k.age_max_months is null or k.age_max_months >= age_months) then 2.0
        when k.age_min_months is not null and k.age_min_months > age_months
         and k.age_min_months <= age_months + 6 then 1.0
        else -2.0
      end as total_score
    from candidates c
    join public.knowledge_chunks k on k.id = c.id
    left join text_scored ts on ts.id = k.id
    left join category_scored cs on cs.id = k.id
  )
  select id, category, title, content
  from scored
  order by total_score desc
  limit result_limit;
$$ language sql stable;

grant execute on function public.search_knowledge_chunks(text, integer, integer) to authenticated, service_role;
