-- Fase 9: módulo de Alimentação. Método alimentar é uma referência a uma
-- linha real de knowledge_chunks (categoria "metodos_alimentacao" — 5
-- linhas já existentes: Tradicional, BLW, BLISS, Participativa/mista,
-- Alimentação responsiva), não um enum novo com hardcode — o mesmo
-- padrão já usado para `messages.activity_id`/`activity_recommendations`
-- (Fase 4/5): "a arquitetura deve permitir métodos diferentes sem
-- hardcode excessivo" fica resolvido simplesmente adicionando uma nova
-- linha em knowledge_chunks no futuro, sem migração nenhuma.
-- feeding_method_custom cobre "outro/personalizado": texto livre da
-- própria família quando nenhuma das opções listadas serve.
--
-- Nenhuma tabela nova para refeições em si — `events.type = 'meal'`
-- já existe (Fase 8) e `events.payload` (jsonb) já era reservado desde
-- a criação da tabela "para campos estruturados por tipo quando
-- tivermos evidência real do que registrar" (ver
-- 20260918004454_create_events_table.sql). Uma refeição registrada é um
-- evento tipo 'meal' com payload = {slot, foods, acceptance,
-- offeringMethodId, suggestionId} — ver src/lib/feeding.ts.
alter table public.children
  add column feeding_method_id text references public.knowledge_chunks (id) on delete set null,
  add column feeding_method_custom text;
