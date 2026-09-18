-- Sprint 2: captura bruta de mensagens do WhatsApp (inbound por enquanto).
-- family_id/caregiver_id ficam nulos quando o número não bate com nenhum
-- cuidador cadastrado; a operação vincula manualmente pela inbox.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families (id) on delete set null,
  caregiver_id uuid references public.caregivers (id) on delete set null,
  wa_message_id text not null unique,
  from_phone_number text not null,
  direction text not null default 'inbound' check (direction in ('inbound', 'outbound')),
  message_type text not null,
  body text,
  raw_payload jsonb not null,
  wa_timestamp timestamptz,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_family_id_idx on public.messages (family_id);
create index messages_created_at_idx on public.messages (created_at desc);

alter table public.messages enable row level security;

-- Operadores autenticados podem ler/triar tudo.
create policy "Operators can manage messages" on public.messages
  for all to authenticated using (true) with check (true);

-- Nenhuma policy para anon/service_role: o webhook do WhatsApp grava via
-- service_role (contorna RLS por padrão), nunca pela chave publicável.
