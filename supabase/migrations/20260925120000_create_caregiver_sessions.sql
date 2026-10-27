-- Fase 2 (produtização do /test): sessão mínima e segura para a experiência
-- real de produto (/quintal), substituindo o modelo de "caregiverId direto
-- na URL" para esse fluxo. Token opaco e não-adivinhável (gerado com
-- randomUUID, nunca o próprio caregiverId), guardado em cookie httpOnly —
-- não é um sistema de autenticação completo (sem login/senha/OTP). É a
-- alternativa mínima segura descrita em docs/ARCHITECTURE_TARGET.md,
-- válida até existir uma decisão definitiva sobre autenticação real de
-- famílias (provavelmente via verificação do número de WhatsApp).
--
-- /test/[caregiverId] continua existindo e continua confiando no id da URL
-- de propósito — é uma ferramenta interna, cujo link só é compartilhado
-- pelo operador. Esta tabela não é usada por ele.
create table public.caregiver_sessions (
  token text primary key,
  caregiver_id uuid not null references public.caregivers (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index caregiver_sessions_caregiver_id_idx on public.caregiver_sessions (caregiver_id);

alter table public.caregiver_sessions enable row level security;

-- Nenhuma policy: só o service_role (via src/lib/familySession.ts) cria ou
-- lê estas linhas. Nunca deve ser alcançável pela chave publicável.
