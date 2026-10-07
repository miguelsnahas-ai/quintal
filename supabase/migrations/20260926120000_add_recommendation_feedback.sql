-- Fase 6: fecha o loop contexto → recomendação → experiência → feedback →
-- próxima recomendação. Duas coisas novas, deliberadamente separadas da
-- recomendação original (nunca a sobrescrevem):
--
-- 1. Duas colunas em activity_recommendations, tratadas como eventos
--    (mesmo padrão de messages.handled_at): source_message_id registra
--    QUAL mensagem do pai/mãe gerou esta recomendação
--    ("recommendation_created", já coberto pelo INSERT nesta tabela
--    desde a Fase 5 — source_message_id só enriquece esse registro);
--    opened_at é setado quando a família de fato abre a atividade a
--    partir do card ("recommendation_opened").
-- 2. activity_recommendation_feedback: tabela nova, propositalmente
--    separada de activity_recommendations (a recomendação em si nunca é
--    alterada por um feedback) e também da activity_feedback já
--    existente da Fase 4 (aquela é feedback avulso na página pública
--    /atividades/[id], sem saber qual recomendação/conversa gerou a
--    visita; esta é feedback de uma recomendação específica dentro da
--    conversa). child_id/activity_id aqui são cópias de
--    activity_recommendations no momento do insert (a fonte da verdade é
--    recommendation_id) — denormalizado de propósito para consultas
--    simples de "o que essa criança já disse sobre atividades" sem join,
--    mesmo padrão de child_id/activity_id em activity_feedback.
alter table public.activity_recommendations
  add column source_message_id uuid references public.messages (id) on delete set null,
  add column opened_at timestamptz;

create table public.activity_recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.activity_recommendations (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  activity_id text not null references public.knowledge_chunks (id) on delete cascade,
  feedback text not null check (feedback in ('worked', 'did_not_work', 'wants_another')),
  note text,
  created_at timestamptz not null default now()
);

create index activity_recommendation_feedback_recommendation_id_idx
  on public.activity_recommendation_feedback (recommendation_id);

create index activity_recommendation_feedback_child_id_idx
  on public.activity_recommendation_feedback (child_id, created_at desc);

alter table public.activity_recommendation_feedback enable row level security;

create policy "Operators can view activity_recommendation_feedback" on public.activity_recommendation_feedback
  for select to authenticated using (true);
