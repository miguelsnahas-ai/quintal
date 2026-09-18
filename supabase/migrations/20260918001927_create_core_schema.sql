-- Sprint 0: fundação da memória estruturada (família, cuidadores, crianças).
-- Sem tabela de "operadores": quem opera a ferramenta interna é gerido via
-- Supabase Auth (auth.users), criado manualmente pelo admin do projeto.

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table public.caregivers (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null,
  role text,
  phone_number text not null unique,
  is_primary_contact boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null,
  birth_date date,
  sex text,
  notes text,
  created_at timestamptz not null default now()
);

create index caregivers_family_id_idx on public.caregivers (family_id);
create index children_family_id_idx on public.children (family_id);

alter table public.families enable row level security;
alter table public.caregivers enable row level security;
alter table public.children enable row level security;

-- MVP concierge: qualquer usuário autenticado na ferramenta interna É um
-- operador (contas criadas manualmente, sem cadastro público). Revisar esta
-- policy quando houver mais de um nível de acesso operacional.
create policy "Operators can manage families" on public.families
  for all to authenticated using (true) with check (true);

create policy "Operators can manage caregivers" on public.caregivers
  for all to authenticated using (true) with check (true);

create policy "Operators can manage children" on public.children
  for all to authenticated using (true) with check (true);
