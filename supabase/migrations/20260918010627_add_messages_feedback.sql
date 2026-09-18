-- Sprint 6: feedback simples sobre respostas enviadas ("isso ajudou?").
-- Só faz sentido em linhas outbound; fica null até o operador registrar.

alter table public.messages
  add column helpful boolean,
  add column feedback_notes text,
  add column feedback_recorded_at timestamptz;
