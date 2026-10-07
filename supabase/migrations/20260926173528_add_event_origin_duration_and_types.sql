-- Fase 8: prepara o schema de events para (a) uma área que ainda não
-- existia (alimentação/"meal" — o Dashboard da Fase 7 já documentava a
-- ausência desse tipo — e passeios/"outing") e (b) rastrear de onde um
-- evento veio e quanto durou, SEM implementar ainda a extração
-- automática por IA a partir do chat (ex.: "ela dormiu das 14h às
-- 15h20" virando start/end sozinho) — isso fica para uma fase futura;
-- aqui só o schema fica pronto para receber esse dado quando existir.
-- Ver docs/ARCHITECTURE_TARGET.md, "Camada de contexto estruturado
-- (Fase 8)".
--
-- Os tipos existentes (sleep/routine/free_play/development/observation/
-- decision) NÃO foram renomeados — só dois novos foram somados.
-- "free_play"/"observation" já cobrem o que o pedido desta fase chamou
-- conceitualmente de "play"/"note"; renomear quebraria dados e código
-- existentes (eventTypeLabels, ChildContext, o formulário de
-- /ops/children/[id], a classificação da IA em suggestEvent.ts) sem
-- necessidade real — a arquitetura já tinha esses conceitos, só com
-- nomes diferentes dos citados no pedido.
alter table public.events
  drop constraint events_type_check,
  add constraint events_type_check check (
    type in ('sleep', 'routine', 'free_play', 'development', 'observation', 'decision', 'meal', 'outing')
  ),
  add column origin text not null default 'manual' check (
    origin in ('manual', 'chat', 'system', 'recommendation')
  ),
  add column duration_minutes integer check (duration_minutes is null or duration_minutes > 0);

-- Backfill honesto: uma linha com source_message_id já veio de uma
-- mensagem de WhatsApp/chat (mesmo dado que /ops/children/[id] já usa
-- para mostrar "via WhatsApp") — refletir isso em origin em vez de
-- marcar tudo como 'manual' por padrão.
update public.events set origin = 'chat' where source_message_id is not null;
