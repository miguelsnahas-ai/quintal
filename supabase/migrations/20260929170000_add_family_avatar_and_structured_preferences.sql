-- Fase 19 (Configurações > Minha família): perfil e preferências da
-- FAMÍLIA — entidade própria, independente de quem está logado (todo
-- cuidador da família lê/edita o mesmo registro).
--
-- 1. families.avatar_url: mesmo padrão de caregivers.avatar_url (Fase 18)
--    — nullable, só URL (sem infraestrutura de upload). families.notes já
--    existe mas é um campo interno de operador (/ops/families/[id]),
--    diferente de "perfil da família" visto pela própria família — não é
--    reaproveitado aqui.
-- 2. family_preferences ganha campos ESTRUTURADOS ao lado dos campos de
--    observação (texto livre) que já existiam desde a Fase 8 e que o chat
--    (chatActions.ts, Fase 15) já sabe editar por categoria — feeding_notes/
--    routine_notes/play_notes/materials_notes/interaction_style continuam
--    exatamente como estão. Os novos campos são o que esta fase pede
--    explicitamente ("quando houver opções estruturadas, usar campos
--    estruturados"):
--    - recommendation_style: estilo de recomendação que a família prefere.
--    - routine_flexibility / routine_activity_focus: preferências de
--      rotina (flexibilidade e casa-vs-fora), como campos curtos e
--      consultáveis em vez de enterrados em routine_notes.
--    - content_focus: quais áreas de conteúdo priorizar — reaproveita o
--      vocabulário de MaterialCategory (src/lib/validation/library.ts),
--      mesma escolha já feita para caregiver_preferences.content_interests
--      (Fase 18), agora no nível da família.
--    Isso é o que a Fase 19 chama de "family.preferences" como estrutura
--    consultável pela IA, não só texto livre.
alter table public.families
  add column avatar_url text;

alter table public.family_preferences
  add column recommendation_style text,
  add column routine_flexibility text,
  add column routine_activity_focus text,
  add column content_focus text[] not null default '{}'::text[];

alter table public.family_preferences
  add constraint family_preferences_recommendation_style_check
    check (recommendation_style is null or recommendation_style in ('practical', 'detailed', 'balanced')),
  add constraint family_preferences_routine_flexibility_check
    check (routine_flexibility is null or routine_flexibility in ('flexible', 'structured', 'balanced')),
  add constraint family_preferences_routine_activity_focus_check
    check (routine_activity_focus is null or routine_activity_focus in ('home', 'outdoor', 'balanced'));
