-- Sprint 3: memória estruturada da criança. Um evento sempre pertence a
-- uma criança específica (nunca só à família), com um tipo fixo (as seis
-- áreas do produto) e notas livres. `payload` fica reservado para campos
-- estruturados por tipo quando tivermos evidência real do que vale a pena
-- capturar (ex: Sprint 4, quando a IA passar a extrair estrutura das
-- mensagens) — por ora sempre '{}'.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  type text not null check (
    type in ('sleep', 'routine', 'free_play', 'development', 'observation', 'decision')
  ),
  occurred_at timestamptz not null default now(),
  notes text not null,
  payload jsonb not null default '{}'::jsonb,
  source_message_id uuid references public.messages (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index events_child_id_idx on public.events (child_id);
create index events_occurred_at_idx on public.events (occurred_at desc);

alter table public.events enable row level security;

create policy "Operators can manage events" on public.events
  for all to authenticated using (true) with check (true);
