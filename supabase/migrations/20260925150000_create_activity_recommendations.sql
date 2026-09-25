-- Fase 5: histórico mínimo de "esta atividade foi recomendada para esta
-- criança, nesta hora" — necessário para a regra de "não repetir uma
-- recomendação recente" do Recommendation Engine (src/lib/recommendation.ts).
--
-- Por que uma tabela nova em vez de reaproveitar messages.activity_id
-- (já existente, Fase 4): messages não tem child_id (é escopada por
-- família — ver docs/ARCHITECTURE_TARGET.md), então numa família com mais
-- de uma criança não dava para responder "o que já foi recomendado para
-- a Laura" sem risco de misturar com o que foi recomendado para um
-- irmão. child_id aqui é obrigatório de propósito — é o único motivo de
-- esta tabela existir.
--
-- RLS ligado, só leitura para authenticated (visibilidade futura em
-- /ops), mesmo padrão de activity_feedback: só o service_role escreve.
create table public.activity_recommendations (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  activity_id text not null references public.knowledge_chunks (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index activity_recommendations_child_id_idx
  on public.activity_recommendations (child_id, created_at desc);

alter table public.activity_recommendations enable row level security;

create policy "Operators can view activity_recommendations" on public.activity_recommendations
  for select to authenticated using (true);
