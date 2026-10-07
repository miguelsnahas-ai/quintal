-- Fase Higiene: fralda é o primeiro cuidado de higiene registrado, como
-- evento do dia a dia (mesma forma que sleep/meal/free_play já vivem em
-- events — ver docs/ARCHITECTURE_TARGET.md). Nenhuma tabela nova para a
-- troca em si: o payload estruturado (tipo xixi/cocô, condição,
-- condição da pele) vive em events.payload, mesmo padrão de 'sleep'
-- (sleepType/endedAt) e 'meal' (slot/foods/acceptance).
alter table public.events
  drop constraint events_type_check,
  add constraint events_type_check check (
    type in ('sleep', 'routine', 'free_play', 'development', 'observation', 'decision', 'meal', 'outing', 'hygiene')
  );
