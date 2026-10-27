-- Fase 16 (reestruturação arquitetural): Family já era a entidade central
-- desde o Sprint 0 (families -> caregivers/children -> events, sempre por
-- family_id/child_id, nunca por um "user_id" direto) — não há um modelo
-- antigo "usuário dono de uma criança" para migrar. O que faltava era:
--   1. Um papel de ACESSO (owner/caregiver) distinto do `caregivers.role`
--      já existente, que é um rótulo de parentesco livre ("mãe", "avó")
--      e continua exatamente como está.
--   2. Uma relação EXPLÍCITA cuidador↔criança (hoje um cuidador enxerga
--      implicitamente toda criança da mesma família, via family_id) —
--      formaliza o que já é verdade hoje, pronta para restringir por
--      criança no futuro sem quebrar nada agora.
--   3. Quem registrou um evento (events.caregiver_id) numa família com
--      mais de um cuidador.
--   4. Convites, para o owner conseguir adicionar cuidadores sem passar
--      por /ops.
-- Ver docs/ARCHITECTURE_TARGET.md, "Família multi-cuidador/multi-criança
-- (Fase 16)".

-- ---------------------------------------------------------------------
-- 1. Papel de acesso do cuidador — nunca confundir com `role` (parentesco
-- livre, ex. "mãe"/"avó", exibido em /ops e /quintal/perfil).
-- ---------------------------------------------------------------------
alter table public.caregivers
  add column access_role text not null default 'caregiver' check (access_role in ('owner', 'caregiver'));

-- Backfill: o cuidador mais antigo de cada família (quem, na prática, deu
-- início ao cadastro em /comecar) vira o owner. is_primary_contact não
-- serve para isso — é uma preferência de "para quem falar", não um papel
-- de administração, e nada garante que só um cuidador por família o tenha.
with earliest_per_family as (
  select distinct on (family_id) id
  from public.caregivers
  order by family_id, created_at asc, id asc
)
update public.caregivers c
set access_role = 'owner'
from earliest_per_family e
where c.id = e.id;

-- Garantia de banco (não só de aplicação): no máximo um owner por família.
-- Combinado com o backfill acima (exatamente um), toda família existente
-- já sai deste passo com exatamente um owner.
create unique index caregivers_one_owner_per_family_idx
  on public.caregivers (family_id)
  where access_role = 'owner';

-- ---------------------------------------------------------------------
-- 2. Relação explícita cuidador↔criança.
-- ---------------------------------------------------------------------
create table public.caregiver_child (
  caregiver_id uuid not null references public.caregivers (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  -- Rótulo opcional e específico desta relação (ex.: "avó materna"),
  -- deliberadamente separado de caregivers.role — este pode variar por
  -- criança (uma pessoa pode ser "madrinha" de uma criança e "tia" de
  -- outra), aquele não. Nulo por padrão: a maioria das famílias nunca
  -- vai precisar preencher isto.
  relationship text,
  created_at timestamptz not null default now(),
  primary key (caregiver_id, child_id)
);

create index caregiver_child_child_id_idx on public.caregiver_child (child_id);

-- Backfill: preserva EXATAMENTE o comportamento implícito de hoje (todo
-- cuidador de uma família enxerga toda criança da mesma família) como
-- linhas explícitas — nenhuma mudança de acesso para nenhuma família
-- existente.
insert into public.caregiver_child (caregiver_id, child_id)
select c.id, ch.id
from public.caregivers c
join public.children ch on ch.family_id = c.family_id;

alter table public.caregiver_child enable row level security;

create policy "Operators can manage caregiver_child" on public.caregiver_child
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 3. Quem registrou um evento — nullable: eventos antigos e os gerados
-- pelo webhook do WhatsApp (sem sessão de cuidador) continuam sem essa
-- informação, o que é honesto (não inventamos um autor).
-- ---------------------------------------------------------------------
alter table public.events
  add column caregiver_id uuid references public.caregivers (id) on delete set null;

create index events_caregiver_id_idx on public.events (caregiver_id);

-- ---------------------------------------------------------------------
-- 4. Convites — o owner adiciona um cuidador sem passar por /ops. Sem
-- envio de e-mail de verdade nesta fase (o produto não tem esse canal
-- hoje, só WhatsApp): o convite gera um link, mesmo padrão já usado para
-- o "Link de teste" de um cuidador em /ops/families/[id]. `email` fica
-- opcional/guardado só como referência de para quem o link foi pensado,
-- nunca usado para enviar nada automaticamente nesta fase.
-- ---------------------------------------------------------------------
create table public.family_invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  email text,
  name text,
  invited_by uuid references public.caregivers (id) on delete set null,
  access_role text not null default 'caregiver' check (access_role in ('owner', 'caregiver')),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index family_invitations_family_id_idx on public.family_invitations (family_id);

alter table public.family_invitations enable row level security;

create policy "Operators can manage family_invitations" on public.family_invitations
  for all to authenticated using (true) with check (true);
