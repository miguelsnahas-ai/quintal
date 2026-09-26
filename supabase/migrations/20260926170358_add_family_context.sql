-- Fase 8: camada estruturada de contexto — família/criança deixam de
-- depender só de texto livre (children.notes) e do histórico da
-- conversa. Duas peças mínimas, reaproveitando padrões já usados no
-- projeto (uma coluna nova quando o dado cabe numa tabela existente;
-- uma tabela nova só quando não cabe):
--
-- 1. children.interests: lista simples de interesses observados da
--    criança (ex.: "carros", "música", "animais") — mesmo padrão de
--    knowledge_chunks.tags (text[], sem tabela de junção nem pontuação/
--    confiança por item, que seria complexidade sem evidência de uso
--    ainda). Editável em /quintal/perfil e lido por getChildContext
--    para entrar no prompt da IA (ver docs/ARCHITECTURE_TARGET.md).
-- 2. family_preferences: preferências da FAMÍLIA (não da criança) sobre
--    alimentação, rotina, brincadeiras, materiais e estilo de interação
--    com o Quintal — conceito novo, sem tabela existente que sirva.
--    Uma linha por família, criada sob demanda (lazy, no primeiro save
--    em /quintal/perfil) — /comecar não foi alterado, uma família nova
--    simplesmente não tem linha aqui até editar.
alter table public.children
  add column interests text[] not null default '{}'::text[];

create table public.family_preferences (
  family_id uuid primary key references public.families (id) on delete cascade,
  feeding_notes text,
  routine_notes text,
  play_notes text,
  materials_notes text,
  interaction_style text,
  updated_at timestamptz not null default now()
);

alter table public.family_preferences enable row level security;

create policy "Operators can manage family_preferences" on public.family_preferences
  for all to authenticated using (true) with check (true);
