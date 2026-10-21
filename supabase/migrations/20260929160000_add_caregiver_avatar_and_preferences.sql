-- Fase 18 (Minha conta > Perfil/Preferências): dados genuinamente
-- PESSOAIS do cuidador — deliberadamente separados de family_preferences
-- (compartilhada pela família, Fase 8) e de qualquer preferência futura
-- por criança. Duas peças mínimas, mesmo padrão já usado desde a Fase
-- 8/16/17 (uma coluna quando o dado cabe numa tabela existente, uma
-- tabela nova só quando não cabe):
--
-- 1. caregivers.avatar_url: "foto/avatar" pedido nesta fase. Nullable,
--    guarda só uma URL — este produto não tem infraestrutura de upload/
--    storage de arquivo ainda (nenhuma outra área tem; imagens de
--    conteúdo em knowledge_chunks.image_url também são sempre URLs
--    pré-existentes, nunca upload do usuário). A UI cai para um avatar
--    de iniciais quando ausente, nunca inventa uma foto.
-- 2. caregiver_preferences: preferências pessoais (o que a pessoa quer
--    ver mais, como prefere que o Quintal se comunique com ELA
--    especificamente) + notificações (Fase 18 pede explicitamente: como
--    não existe infraestrutura de ENVIO de notificação ainda, só a
--    configuração e a persistência são criadas aqui — nenhum job/e-mail/
--    push é implementado). Uma linha por cuidador, criada sob demanda no
--    primeiro save (lazy), mesmo padrão de family_preferences.
create table public.caregiver_preferences (
  caregiver_id uuid primary key references public.caregivers (id) on delete cascade,
  -- Reaproveita o vocabulário já existente de categorias de Materiais
  -- (src/lib/validation/library.ts) em vez de inventar uma lista nova —
  -- "que tipo de conteúdo você quer ver mais" already tem um
  -- vocabulário pronto e usado em produção (Fase 12).
  content_interests text[] not null default '{}'::text[],
  communication_style text,
  notify_general boolean not null default true,
  notify_reminders boolean not null default true,
  notify_recommendations boolean not null default true,
  notify_routine_updates boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.caregivers
  add column avatar_url text;

alter table public.caregiver_preferences enable row level security;

create policy "Operators can manage caregiver_preferences" on public.caregiver_preferences
  for all to authenticated using (true) with check (true);
