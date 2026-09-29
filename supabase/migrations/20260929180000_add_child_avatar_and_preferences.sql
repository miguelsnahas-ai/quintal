-- Fase 20 (Configurações > Crianças): perfil e preferências de CADA
-- criança — cada uma com seu próprio contexto (nunca misturado entre
-- irmãos, mesma garantia de escopo por child_id que todo o resto do
-- produto já segue desde a Fase 16).
--
-- 1. children.avatar_url: mesmo padrão de caregivers/families.avatar_url
--    (Fases 18/19) — nullable, só URL.
-- 2. child_preferences: DADOS ESTRUTURADOS (campos com vocabulário fixo,
--    consultáveis por valor exato) ao lado de OBSERVAÇÕES LIVRES (texto),
--    pedido explícito desta fase para o futuro mecanismo de IA/
--    recomendação. Não inclui "interesses" (já existe em
--    children.interests, Fase 8) nem "método alimentar" (já existe em
--    children.feeding_method_id/feeding_method_custom, Fase 9 — Fase 20
--    pede explicitamente para não duplicar isso, só expor em
--    Configurações). "Sobre esta criança" (observações contextuais mais
--    gerais, fora do escopo de preferências) reaproveita children.notes,
--    que já existia mas era só editável por operador — vira também
--    family-facing nesta fase.
create table public.child_preferences (
  child_id uuid primary key references public.children (id) on delete cascade,
  -- Estruturado: tags livres, mesmo padrão de children.interests (Fase 8).
  favorite_activities text[] not null default '{}'::text[],
  preferred_materials text[] not null default '{}'::text[],
  -- Estruturado: vocabulário fixo (ver src/lib/validation/profile.ts).
  routine_preference text,
  activity_style text,
  -- Observação livre por área — igual family_preferences (Fase 8/19): o
  -- chat/IA pode ler isolado por campo em vez de um bloco só de texto.
  routine_notes text,
  feeding_notes text,
  caregiver_notes text,
  updated_at timestamptz not null default now()
);

alter table public.child_preferences
  add constraint child_preferences_routine_preference_check
    check (routine_preference is null or routine_preference in ('predictable', 'flexible', 'balanced')),
  add constraint child_preferences_activity_style_check
    check (activity_style is null or activity_style in ('calm', 'energetic', 'balanced'));

alter table public.children
  add column avatar_url text;

alter table public.child_preferences enable row level security;

create policy "Operators can manage child_preferences" on public.child_preferences
  for all to authenticated using (true) with check (true);
