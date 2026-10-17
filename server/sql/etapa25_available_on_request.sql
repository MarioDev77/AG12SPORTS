-- ============================================================
-- ETAPA 25 — "Disponível para pedidos" (encomenda) separado de "Pronta entrega"
-- ============================================================
-- Migration ADITIVA e idempotente.
--
-- products.available_for_order  → PRONTA ENTREGA (já existia): em estoque,
--                                  o cliente compra direto pelo site.
-- products.available_on_request → ENCOMENDA / "Disponível para pedidos"
--                                  (nova): sob consulta, via WhatsApp.
-- Um produto pode ter as duas marcadas.
--
-- Preserva o comportamento atual: quem NÃO era pronta entrega já era tratado
-- como encomenda, então esses produtos recebem available_on_request = 1 —
-- mas só na criação da coluna (rodar de novo não sobrescreve escolhas do admin).
--
-- Uso: node run-migration.js sql/etapa25_available_on_request.sql
-- RODE ANTES de publicar a nova versão da API.
-- ============================================================

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'available_on_request'
);
SET @sql_col = IF(@col_exists = 0,
  'ALTER TABLE products ADD COLUMN available_on_request TINYINT(1) NOT NULL DEFAULT 0 AFTER available_for_order',
  'SELECT "available_on_request already exists"');
PREPARE stmt FROM @sql_col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql_fill = IF(@col_exists = 0,
  'UPDATE products SET available_on_request = 1 WHERE available_for_order = 0',
  'SELECT "backfill skipped (coluna já existia)"');
PREPARE stmt FROM @sql_fill; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT
  SUM(available_for_order = 1) AS pronta_entrega,
  SUM(available_on_request = 1) AS encomenda,
  SUM(available_for_order = 1 AND available_on_request = 1) AS ambos
FROM products;
