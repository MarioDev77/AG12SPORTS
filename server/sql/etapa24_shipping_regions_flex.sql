-- ============================================================
-- ETAPA 24 — Libera regras específicas em shipping_regions
-- ============================================================
-- Migration ADITIVA (remove só uma restrição, nenhum dado é apagado).
--
-- A etapa 22 adicionou `cidade`/`cep_prefix` em shipping_regions, mas a
-- tabela ainda tinha UNIQUE KEY só na coluna `uf` (da etapa 19) — isso
-- impedia cadastrar uma regra específica de cidade/CEP pra um estado que
-- já tem regra geral (ex: já existe BA genérico, não dava pra adicionar
-- BA + Salvador). Essa migration remove essa trava.
--
-- Nenhuma linha existente é alterada — só a restrição sai.
-- Idempotente: confere se o índice existe antes de tentar remover.
-- ============================================================

USE pitch_futebol;

SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'shipping_regions' AND index_name = 'uk_shipping_regions_uf'
);
SET @sql_drop = IF(@idx_exists > 0,
  'ALTER TABLE shipping_regions DROP INDEX uk_shipping_regions_uf',
  'SELECT "uk_shipping_regions_uf already removed"');
PREPARE stmt FROM @sql_drop; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Confirma o resultado (0 = removido/já não existia).
SELECT
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'shipping_regions' AND index_name = 'uk_shipping_regions_uf') AS old_unique_key_still_there;
