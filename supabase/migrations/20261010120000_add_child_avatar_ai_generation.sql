-- Módulo de avatar em IA (pedido explícito): uma imagem ilustrada de
-- "traço de giz" gerada a partir de atributos selecionáveis — nunca uma
-- foto real da criança (não há upload de foto no produto, só os
-- atributos abaixo), então a imagem é sempre uma ilustração, nunca
-- reivindicada como "parecida de verdade" além do que os atributos
-- escolhidos descrevem (ver src/lib/avatarGenerator.ts).
--
-- 1. child_avatar_attributes: os atributos selecionados por último para
--    cada criança — vocabulário fixo (ver src/lib/validation/avatar.ts),
--    mesmo critério de child_preferences.routine_preference/
--    activity_style (Fase 20): check constraint em vez de enum do
--    Postgres, pra alterar o vocabulário só com uma migration simples.
-- 2. child_avatar_generations: log de cada geração, só para o limite
--    diário (5/dia, configurável em avatarGenerator.ts) — child_id é
--    opcional porque a geração pode acontecer no onboarding, antes da
--    criança existir (nesse caso o limite do dia é contado por
--    caregiver_id entre as linhas sem child_id).
create table public.child_avatar_attributes (
  child_id uuid primary key references public.children (id) on delete cascade,
  skin_tone text not null,
  hair_color text not null,
  hair_style text not null,
  eye_color text not null,
  vibe text not null,
  updated_at timestamptz not null default now()
);

alter table public.child_avatar_attributes
  add constraint child_avatar_attributes_skin_tone_check
    check (skin_tone in ('clara', 'morena_clara', 'morena', 'escura')),
  add constraint child_avatar_attributes_hair_color_check
    check (hair_color in ('preto', 'castanho', 'castanho_claro', 'ruivo', 'loiro')),
  add constraint child_avatar_attributes_hair_style_check
    check (hair_style in ('liso', 'ondulado', 'cacheado', 'crespo', 'careca')),
  add constraint child_avatar_attributes_eye_color_check
    check (eye_color in ('castanho', 'preto', 'verde', 'azul', 'mel')),
  add constraint child_avatar_attributes_vibe_check
    check (vibe in ('alegre', 'tranquilo', 'aventureiro', 'sonhador'));

create table public.child_avatar_generations (
  id uuid primary key default gen_random_uuid(),
  child_id uuid references public.children (id) on delete cascade,
  caregiver_id uuid not null references public.caregivers (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index child_avatar_generations_child_id_created_at_idx
  on public.child_avatar_generations (child_id, created_at);
create index child_avatar_generations_caregiver_id_created_at_idx
  on public.child_avatar_generations (caregiver_id, created_at)
  where child_id is null;

alter table public.child_avatar_attributes enable row level security;
alter table public.child_avatar_generations enable row level security;

create policy "Operators can manage child_avatar_attributes" on public.child_avatar_attributes
  for all to authenticated using (true) with check (true);
create policy "Operators can manage child_avatar_generations" on public.child_avatar_generations
  for all to authenticated using (true) with check (true);

-- Bucket público para as imagens geradas — mesmo raciocínio de
-- avatar_url nas outras tabelas (families/caregivers/children): só uma
-- URL pública, sem política extra de leitura (bucket "public" já serve
-- qualquer objeto via URL direta, sem passar pela RLS de storage.objects).
-- Escrita é sempre via service role (bypassa RLS), nunca client-side.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
