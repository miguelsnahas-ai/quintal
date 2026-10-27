-- Revisão completa da área de Configurações (integrar/simplificar/corrigir
-- inconsistências, sem funcionalidade nova). Achado do model-audit: duas
-- caixas de texto livre por criança, sem diferença clara de propósito —
-- children.notes ("Sobre esta criança", Fase 8, exposta family-facing na
-- Fase 20) e child_preferences.caregiver_notes ("Observações dos
-- cuidadores", também Fase 20). Consolidado num só campo: children.notes
-- (o mais antigo, já com histórico e já formatado no contexto de IA desde
-- a Fase 8) — caregiver_notes sai do schema, não só da UI, para o modelo
-- de dados não voltar a divergir da tela.
alter table public.child_preferences
  drop column caregiver_notes;
