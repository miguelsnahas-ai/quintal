-- Onboarding guiado (pedido explícito): tour de 1 vez só no primeiro
-- acesso + checklist "Primeiros passos" na Home. Por família (não por
-- cuidador) — mesmo critério de family_preferences: qualquer cuidador
-- que já viu o tour/timeline conta pra família toda, não precisa repetir
-- por pessoa. Só guarda o que NÃO pode ser derivado de dado real: "já
-- registrou algo", "já conversou no chat" e "já tem mais de um
-- cuidador" vêm de children/events/messages/caregivers (ver
-- src/lib/onboardingProgress.ts) — nunca duplicados aqui.
create table public.family_onboarding_progress (
  family_id uuid primary key references public.families (id) on delete cascade,
  tour_completed_at timestamptz,
  viewed_timeline_at timestamptz,
  checklist_dismissed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.family_onboarding_progress enable row level security;

create policy "Operators can manage family_onboarding_progress" on public.family_onboarding_progress
  for all to authenticated using (true) with check (true);
