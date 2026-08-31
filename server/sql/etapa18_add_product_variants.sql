-- ============================================================
-- ETAPA 18 — Variantes de tamanho/estoque + "disponível para pedidos"
-- ============================================================
-- Migration ADITIVA — não apaga nem altera dados existentes.
--
-- 1) products.available_for_order: flag Sim/Não do admin. Default 0
--    (Não) — nenhum produto existente muda de comportamento sozinho.
--
-- 2) product_variants: uma linha por (produto, tamanho), com estoque
--    próprio. Passa a ser a fonte de verdade de tamanho/estoque para
--    os produtos com "disponível para pedidos" = Sim.
--
--    products.sizes_json e products.stock_qty NÃO são removidos nem
--    deixam de ser usados — o storefront atual e os filtros dependem
--    deles. A partir desta etapa, sempre que as variantes de um
--    produto forem alteradas pelo admin, esses dois campos são
--    recalculados automaticamente pelo backend (sizes_json = tamanhos
--    ativos com estoque, stock_qty = soma dos estoques) para
--    continuarem corretos sem precisar editar o resto do sistema.
--
-- Idempotente: usa o mesmo padrão information_schema da etapa6, já que
-- a versão do MySQL do servidor não aceita ADD COLUMN IF NOT EXISTS.
-- ============================================================

USE pitch_futebol;

-- ── products.available_for_order ──────────────────────────────────────────
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'available_for_order'
);
SET @sql_col = IF(@col_exists = 0,
  'ALTER TABLE products ADD COLUMN available_for_order TINYINT(1) NOT NULL DEFAULT 0 AFTER is_featured',
  'SELECT "available_for_order already exists"');
PREPARE stmt FROM @sql_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ── product_variants ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_variants (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  size VARCHAR(20) NOT NULL,
  sku VARCHAR(60) NULL,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_product_variants_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE,

  UNIQUE KEY uk_product_variants_product_size (product_id, size),
  INDEX idx_product_variants_product_id (product_id)
) ENGINE=InnoDB;

-- Confirma o resultado.
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'available_for_order') AS available_for_order_ok,
  (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'product_variants') AS product_variants_table_ok;
