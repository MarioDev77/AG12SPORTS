-- ============================================================
-- ETAPA 19 — Checkout: endereços, frete, pedidos
-- ============================================================
-- Recria (de forma adaptada) o que existia antes da etapa 12
-- (orders/order_items), agora integrado com product_variants
-- (etapa18) em vez de products.stock_qty isolado, e acrescenta
-- o que não existia antes: endereços reutilizáveis (com consulta
-- de CEP) e regras de frete por estado (shipping_regions).
--
-- Migration ADITIVA — não apaga nem altera dados existentes.
-- CREATE TABLE IF NOT EXISTS é nativamente idempotente, então não
-- precisa do padrão information_schema usado pra ADD COLUMN.
-- ============================================================

USE pitch_futebol;

-- ── addresses — endereços salvos por cliente (reuso em pedidos futuros) ───
CREATE TABLE IF NOT EXISTS addresses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  cep VARCHAR(9) NOT NULL,
  logradouro VARCHAR(160) NOT NULL,
  numero VARCHAR(20) NOT NULL,
  complemento VARCHAR(80) NULL,
  bairro VARCHAR(120) NOT NULL,
  cidade VARCHAR(120) NOT NULL,
  uf CHAR(2) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_addresses_user_id (user_id)
) ENGINE=InnoDB;

-- ── shipping_regions — prazo/valor de frete por estado (UF) ────────────────
-- uf = '*' é a regra padrão usada quando não existe uma regra específica
-- para o estado do cliente. O admin pode sobrescrever por UF.
CREATE TABLE IF NOT EXISTS shipping_regions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uf CHAR(2) NOT NULL,
  delivery_min_days INT UNSIGNED NOT NULL,
  delivery_max_days INT UNSIGNED NOT NULL,
  shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_shipping_regions_uf (uf)
) ENGINE=InnoDB;

-- Regra padrão de fallback (só insere se ainda não existir nenhuma regra '*').
INSERT INTO shipping_regions (uf, delivery_min_days, delivery_max_days, shipping_cost, active)
SELECT '*', 5, 10, 25.00, 1
WHERE NOT EXISTS (SELECT 1 FROM shipping_regions WHERE uf = '*');

-- Bahia (BA) — regra local mais rápida/barata, o admin pode ajustar depois.
INSERT INTO shipping_regions (uf, delivery_min_days, delivery_max_days, shipping_cost, active)
SELECT 'BA', 2, 5, 15.00, 1
WHERE NOT EXISTS (SELECT 1 FROM shipping_regions WHERE uf = 'BA');

-- ── orders ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending','paid','processing','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',

  customer_name VARCHAR(120) NOT NULL,
  customer_cpf_hash CHAR(64) NULL,
  email VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL,

  -- Snapshot do endereço no momento do pedido (não muda se o cliente editar
  -- o endereço salvo depois) — mesmo princípio de snapshot já usado em
  -- order_items.product_name_snapshot.
  address_cep VARCHAR(9) NOT NULL,
  address_logradouro VARCHAR(160) NOT NULL,
  address_numero VARCHAR(20) NOT NULL,
  address_complemento VARCHAR(80) NULL,
  address_bairro VARCHAR(120) NOT NULL,
  address_cidade VARCHAR(120) NOT NULL,
  address_uf CHAR(2) NOT NULL,

  payment_method ENUM('pix','cartao','boleto') NOT NULL,
  subtotal_amount DECIMAL(10,2) NOT NULL,
  shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  estimated_delivery_min_days INT UNSIGNED NULL,
  estimated_delivery_max_days INT UNSIGNED NULL,

  -- Notificação do admin: fica 0 até alguém do admin abrir o pedido.
  viewed_by_admin TINYINT(1) NOT NULL DEFAULT 0,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_orders_user_id (user_id),
  INDEX idx_orders_status (status),
  INDEX idx_orders_viewed (viewed_by_admin)
) ENGINE=InnoDB;

-- ── order_items ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id INT NOT NULL,
  product_variant_id INT UNSIGNED NULL,
  product_name_snapshot VARCHAR(160) NOT NULL,
  product_brand_snapshot VARCHAR(120) NULL,
  size VARCHAR(20) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  qty INT UNSIGNED NOT NULL,
  line_total DECIMAL(10,2) NOT NULL,

  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_order_items_variant FOREIGN KEY (product_variant_id) REFERENCES product_variants(id),
  INDEX idx_order_items_order_id (order_id)
) ENGINE=InnoDB;

-- Confirma o resultado.
SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'addresses') AS addresses_ok,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'shipping_regions') AS shipping_regions_ok,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'orders') AS orders_ok,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'order_items') AS order_items_ok;
