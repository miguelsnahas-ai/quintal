-- Instruções extras que o admin pode ajustar sem precisar de deploy,
-- anexadas ao prompt do sistema em suggestEvent/suggestReply. Linha única
-- (id fixo), sempre a mais atual.

create table public.ai_settings (
  id uuid primary key default '00000000-0000-0000-0000-000000000001'::uuid,
  custom_instructions text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.ai_settings (id) values ('00000000-0000-0000-0000-000000000001'::uuid);

alter table public.ai_settings enable row level security;

create policy "Operators can manage ai_settings" on public.ai_settings
  for all to authenticated using (true) with check (true);

-- Nenhuma policy para anon: leitura acontece via service_role, tanto na
-- página pública de teste (/test/[caregiverId]) quanto nas ações da
-- ferramenta interna, para não depender de sessão de usuário.
