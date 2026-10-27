-- Sprint 5: envio de resposta pelo WhatsApp. Mensagens outbound já eram
-- suportadas pelo check constraint de `direction` desde a Sprint 2; agora
-- passam a existir de fato, então guardamos a qual mensagem inbound cada
-- resposta se refere.

alter table public.messages
  add column in_reply_to_message_id uuid references public.messages (id) on delete set null;

create index messages_in_reply_to_message_id_idx on public.messages (in_reply_to_message_id);
