-- Fase 4: liga uma resposta da IA a uma atividade concreta da base de
-- conhecimento (brincadeiras/materiais), em vez de terminar em texto solto
-- tipo "você pode brincar de X". Guardado na própria mensagem outbound
-- para que a referência fique registrada junto com a resposta que a
-- gerou (rehidratar o card ao reabrir o histórico fica para depois — ver
-- docs/PRODUCT_ROADMAP.md).
alter table public.messages
  add column activity_id text references public.knowledge_chunks (id) on delete set null;

-- Feedback mínimo de "essa atividade ajudou?" — dado real de produto que
-- não cabe em knowledge_chunks (conteúdo de referência, só leitura) nem em
-- events (tipos fixos, sempre por criança, sem "sim/não"). RLS ligado, sem
-- policy de insert: só o service_role escreve, mesmo padrão de
-- ai_settings/knowledge_chunks.
create table public.activity_feedback (
  id uuid primary key default gen_random_uuid(),
  activity_id text not null references public.knowledge_chunks (id) on delete cascade,
  child_id uuid references public.children (id) on delete set null,
  caregiver_id uuid references public.caregivers (id) on delete set null,
  helpful boolean not null,
  created_at timestamptz not null default now()
);

create index activity_feedback_activity_id_idx on public.activity_feedback (activity_id);

alter table public.activity_feedback enable row level security;

create policy "Operators can view activity_feedback" on public.activity_feedback
  for select to authenticated using (true);
