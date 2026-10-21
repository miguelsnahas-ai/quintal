-- Fase Higiene: duas entidades próprias, separadas do log de trocas
-- (events.type = 'hygiene') porque são de natureza diferente — não são
-- "coisas que aconteceram num instante", são ESTADO que vale por um
-- período (qual fralda a família está usando agora, quanto tem em
-- estoque). Reutilizar `events` para isso misturaria um fato pontual com
-- um fato de validade contínua, e tornaria "qual é a fralda atual?"
-- uma consulta estranha (teria que reconstruir estado a partir de um
-- log de eventos). Sempre vinculada a child_id, nunca só a family_id —
-- cada criança tem seu próprio histórico (pedido explícito desta fase).
--
-- diaper_profiles: histórico de "perfis" de fralda ao longo do tempo —
-- múltiplas linhas por criança (o tamanho muda conforme ela cresce), a
-- mais recente por started_at é "a fralda atual". Sem catálogo de
-- marcas (pedido explícito): brand/model/size são texto livre.
create table public.diaper_profiles (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  brand text,
  model text,
  size text,
  started_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index diaper_profiles_child_id_idx on public.diaper_profiles (child_id);
create index diaper_profiles_started_at_idx on public.diaper_profiles (child_id, started_at desc);

-- diaper_stock: linhas de estoque (pode haver mais de uma — tamanhos ou
-- marcas diferentes guardados ao mesmo tempo, ex. durante uma troca de
-- tamanho). Consumo/estimativa de duração NÃO é calculado aqui nem em
-- código nesta fase (pedido explícito: "não inventar estimativas") —
-- só o que foi informado, quantity é editado diretamente pela família.
create table public.diaper_stock (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  brand text,
  model text,
  size text,
  quantity integer not null default 0 check (quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index diaper_stock_child_id_idx on public.diaper_stock (child_id);

alter table public.diaper_profiles enable row level security;
alter table public.diaper_stock enable row level security;

create policy "Operators can manage diaper_profiles" on public.diaper_profiles
  for all to authenticated using (true) with check (true);

create policy "Operators can manage diaper_stock" on public.diaper_stock
  for all to authenticated using (true) with check (true);
