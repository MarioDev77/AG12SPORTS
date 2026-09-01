-- ============================================================
-- ETAPA 20 — Escopo do envio (nacional/internacional) + rastreio
-- ============================================================
-- Migration ADITIVA — não apaga nem altera dados existentes.
--
-- 1) orders.shipment_scope: o admin define se aquele pedido é nacional
--    ou internacional. Default 'nacional' — nenhum pedido existente
--    muda de comportamento sozinho.
--
-- 2) orders.tracking_carrier / tracking_code / tracking_url: dados de
--    rastreio preenchidos pelo admin quando o pedido é enviado. Ficam
--    NULL até lá (não aparecem pro cliente enquanto vazios).
--
-- Idempotente: mesmo padrão information_schema das etapas 6/18, já que
-- a versão do MySQL do servidor não aceita ADD COLUMN IF NOT EXISTS.
-- ============================================================

USE pitch_futebol;

-- ── orders.shipment_scope ───────────────────────────────────────────────────
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'shipment_scope'
);
SET @sql_col = IF(@col_exists = 0,
  "ALTER TABLE orders ADD COLUMN shipment_scope ENUM('nacional','internacional') NOT NULL DEFAULT 'nacional' AFTER status",
  'SELECT "shipment_scope already exists"');
PREPARE stmt FROM @sql_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ── orders.tracking_carrier ──────────────────────────────────────────────────
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'tracking_carrier'
);
SET @sql_col = IF(@col_exists = 0,
  'ALTER TABLE orders ADD COLUMN tracking_carrier VARCHAR(80) NULL AFTER shipment_scope',
  'SELECT "tracking_carrier already exists"');
PREPARE stmt FROM @sql_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ── orders.tracking_code ─────────────────────────────────────────────────────
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'tracking_code'
);
SET @sql_col = IF(@col_exists = 0,
  'ALTER TABLE orders ADD COLUMN tracking_code VARCHAR(60) NULL AFTER tracking_carrier',
  'SELECT "tracking_code already exists"');
PREPARE stmt FROM @sql_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ── orders.tracking_url ──────────────────────────────────────────────────────
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'tracking_url'
);
SET @sql_col = IF(@col_exists = 0,
  'ALTER TABLE orders ADD COLUMN tracking_url VARCHAR(255) NULL AFTER tracking_code',
  'SELECT "tracking_url already exists"');
PREPARE stmt FROM @sql_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Confirma o resultado.
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'shipment_scope') AS shipment_scope_ok,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'tracking_carrier') AS tracking_carrier_ok,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'tracking_code') AS tracking_code_ok,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'tracking_url') AS tracking_url_ok;
