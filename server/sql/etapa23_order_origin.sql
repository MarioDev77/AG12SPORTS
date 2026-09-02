-- ============================================================
-- ETAPA 23 — Origem do pedido (etapa B do plano)
-- ============================================================
-- Migration ADITIVA — não apaga nem altera dados existentes.
--
-- orders.origin_id: de qual depósito (tabela `origins`, etapa 21) aquele
-- pedido foi/será despachado. NULL até o admin escolher — pedidos
-- antigos e novos continuam funcionando normalmente sem isso.
-- ON DELETE SET NULL: se um depósito for excluído (só é permitido se não
-- estiver em uso — ver origins.service.js), pedidos não ficam órfãos.
--
-- Idempotente: ADD COLUMN via information_schema (mesmo padrão das
-- etapas 6/18/20/22); a FOREIGN KEY também checa se já existe antes de
-- criar, pra rodar de novo sem erro.
-- ============================================================

USE pitch_futebol;

-- ── orders.origin_id ─────────────────────────────────────────────────────────
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'origin_id'
);
SET @sql_col = IF(@col_exists = 0,
  'ALTER TABLE orders ADD COLUMN origin_id INT UNSIGNED NULL AFTER shipment_scope',
  'SELECT "origin_id already exists"');
PREPARE stmt FROM @sql_col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── FK orders.origin_id → origins.id ──────────────────────────────────────────
SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE table_schema = DATABASE() AND table_name = 'orders' AND constraint_name = 'fk_orders_origin'
);
SET @sql_fk = IF(@fk_exists = 0,
  'ALTER TABLE orders ADD CONSTRAINT fk_orders_origin FOREIGN KEY (origin_id) REFERENCES origins(id) ON DELETE SET NULL',
  'SELECT "fk_orders_origin already exists"');
PREPARE stmt FROM @sql_fk; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Índice pra filtrar/relatar pedidos por depósito sem full scan.
SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'idx_orders_origin'
);
SET @sql_idx = IF(@idx_exists = 0,
  'ALTER TABLE orders ADD INDEX idx_orders_origin (origin_id)',
  'SELECT "idx_orders_origin already exists"');
PREPARE stmt FROM @sql_idx; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Confirma o resultado.
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'origin_id') AS origin_id_ok,
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'orders' AND constraint_name = 'fk_orders_origin') AS fk_ok;
