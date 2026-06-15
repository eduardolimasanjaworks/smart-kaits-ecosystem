-- F1-1: mês previsto do evento (nullable) para ranking e filtros de relatório.
-- F1-21: se p95 em /relatorios/resumo ou /relatorios/funil > 300ms, considerar:
--   CREATE INDEX idx_negociacao_mes_previsto ON negociacao (mes_previsto_evento)
--     WHERE mes_previsto_evento IS NOT NULL;
--   CREATE INDEX idx_negociacao_lead_criado ON negociacao (lead_id, criado_em);
ALTER TABLE "negociacao" ADD COLUMN IF NOT EXISTS "mes_previsto_evento" date;
