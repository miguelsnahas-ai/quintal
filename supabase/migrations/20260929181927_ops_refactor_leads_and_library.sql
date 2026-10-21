-- Refatoração do /ops (backoffice): dá às duas entidades que a nova área
-- precisa (Lista de interesse, Biblioteca) o mínimo de schema que faltava
-- para virar operável, sem inventar uma segunda fonte de verdade — ambas
-- continuam sendo waitlist_leads e knowledge_chunks, só com o necessário
-- para status/edição/conversão.

-- ---------------------------------------------------------------------
-- 1. Lista de interesse (waitlist_leads) — status simples pedido
-- explicitamente (Novo/Em contato/Interessado/Convertido/Não
-- interessado), observações internas da equipe (distintas das respostas
-- do próprio formulário) e o vínculo com a família quando convertido.
-- Todo lead existente entra como 'novo' — nunca adivinha conversão por
-- correspondência de telefone/e-mail (formatos divergem entre o que a
-- pessoa digitou na landing e o phone_number normalizado de caregivers;
-- a única forma seria a ação "Converter em família" desta fase).
-- ---------------------------------------------------------------------
alter table public.waitlist_leads
  add column status text not null default 'novo',
  add column notes text,
  add column converted_family_id uuid references public.families (id) on delete set null;

alter table public.waitlist_leads
  add constraint waitlist_leads_status_check
    check (status in ('novo', 'em_contato', 'interessado', 'convertido', 'nao_interessado'));

create index waitlist_leads_status_idx on public.waitlist_leads (status);
create index waitlist_leads_converted_family_id_idx on public.waitlist_leads (converted_family_id);

-- A equipe precisa editar status/observações/conversão — só tinha select.
create policy "Operators can update waitlist_leads" on public.waitlist_leads
  for update to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 2. Biblioteca (knowledge_chunks) — status Published/Draft/Archived
-- pedido explicitamente, mais updated_at (a tabela só tinha created_at).
-- Todo conteúdo existente (531 linhas seedadas via migration/planilha)
-- entra como 'published': é exatamente o que já está em produção hoje
-- alimentando recomendações, métodos alimentares e receitas — a troca de
-- status não pode mudar silenciosamente o que a IA já recomenda.
-- A tabela só tinha policy de leitura (referência seedada por migration);
-- a nova tela de Biblioteca em /ops precisa criar/editar/arquivar.
-- ---------------------------------------------------------------------
alter table public.knowledge_chunks
  add column status text not null default 'published',
  add column updated_at timestamptz not null default now();

alter table public.knowledge_chunks
  add constraint knowledge_chunks_status_check
    check (status in ('published', 'draft', 'archived'));

create index knowledge_chunks_status_idx on public.knowledge_chunks (status);

create policy "Operators can insert knowledge_chunks" on public.knowledge_chunks
  for insert to authenticated with check (true);
create policy "Operators can update knowledge_chunks" on public.knowledge_chunks
  for update to authenticated using (true) with check (true);
create policy "Operators can delete knowledge_chunks" on public.knowledge_chunks
  for delete to authenticated using (true);

-- search_knowledge_chunks (RAG da IA) nunca pode devolver rascunho ou
-- arquivado — só o "status = 'published'" muda nesta função em relação à
-- versão anterior (20260924193755_add_search_knowledge_chunks_function.sql);
-- toda a lógica de score/IDF permanece idêntica. Adicionado em CADA
-- subconsulta que lê knowledge_chunks (total/idf/text_scored/
-- category_scored/scored), não só no resultado final, para o cálculo de
-- IDF em si não ficar enviesado por conteúdo que nunca deveria aparecer.
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
    select count(*)::float as n from public.knowledge_chunks where status = 'published'
  ),
  query_terms as (
    select distinct lexeme as lex
    from unnest(tsvector_to_array(to_tsvector('portuguese', message))) as lexeme
  ),
  idf_terms as (
    select qt.lex, ln(total.n / doc_freq) as idf
    from query_terms qt, total,
      lateral (
        select count(*) as doc_freq from public.knowledge_chunks k
        where k.status = 'published' and k.search @@ to_tsquery('simple', qt.lex)
      ) df
    where doc_freq > 0
  ),
  text_scored as (
    select k.id, sum(it.idf) as text_score,
      sum(case when to_tsvector('portuguese', k.title) @@ to_tsquery('simple', it.lex) then it.idf * 3 else 0 end) as title_bonus
    from public.knowledge_chunks k
    join idf_terms it on k.search @@ to_tsquery('simple', it.lex)
    where k.status = 'published'
    group by k.id
  ),
  category_scored as (
    select k.id, count(*) * 6.0 as category_bonus
    from public.knowledge_chunks k, query_terms qt
    where k.status = 'published'
      and to_tsvector('portuguese', replace(k.category, '_', ' ')) @@ to_tsquery('simple', qt.lex)
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
    where k.status = 'published'
  )
  select id, category, title, content
  from scored
  order by total_score desc
  limit result_limit;
$$ language sql stable;
