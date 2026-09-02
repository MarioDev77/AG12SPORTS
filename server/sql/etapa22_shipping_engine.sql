-- ============================================================
-- ETAPA 22 — Motor de estimativa de entrega
-- ============================================================
-- Migration ADITIVA — não apaga nem altera dados existentes.
-- Plano enxuto (2 tabelas novas, o resto reaproveita o que já existe):
--
-- 1) origins.is_default — marca qual depósito é a origem padrão da loja,
--    usada no cálculo enquanto o pedido ainda não tem origem própria
--    (etapa 22 aqui) ou quando o admin ainda não escolheu uma (etapa 21).
--
-- 2) shipping_regions ganha cidade/cep_prefix (nullable) — regra mais
--    específica que UF, sem precisar de tabelas novas
--    (shipping_city_rules/shipping_cep_rules). Prioridade de busca:
--    cep_prefix > cidade > uf > '*' (fallback, como já era).
--
-- 3) holidays (nova) — feriados nacionais/estaduais/municipais, usados
--    pelo addBusinessDays() pra não contar dia útil em cima de feriado.
--
-- 4) shipping_settings (nova) — config única (singleton, id=1): tempo de
--    preparação, margem de segurança e parâmetros do ajuste por
--    distância (usado só quando origem E destino têm lat/lng — senão o
--    cálculo cai 100% na tabela de regiões, como já funciona hoje).
--
-- 5) orders.estimated_delivery_min_date / max_date — data calculada,
--    ao lado dos campos de dias que já existiam (preservados,
--    continuam sendo a fonte de verdade pra pedidos antigos).
--
-- Idempotente: ADD COLUMN via information_schema (mesmo padrão das
-- etapas 6/18/20); CREATE TABLE IF NOT EXISTS pras tabelas novas.
-- ============================================================

USE pitch_futebol;

-- ── origins.is_default ──────────────────────────────────────────────────────
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'origins' AND column_name = 'is_default'
);
SET @sql_col = IF(@col_exists = 0,
  'ALTER TABLE origins ADD COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0 AFTER active',
  'SELECT "is_default already exists"');
PREPARE stmt FROM @sql_col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Se nenhuma origem foi marcada como padrão ainda, marca a mais antiga
-- ativa — idempotente (só roda o UPDATE se realmente não houver nenhuma).
SET @has_default = (SELECT COUNT(*) FROM origins WHERE is_default = 1);
SET @sql_default = IF(@has_default = 0,
  'UPDATE origins SET is_default = 1 WHERE active = 1 ORDER BY id ASC LIMIT 1',
  'SELECT "default origin already set"');
PREPARE stmt FROM @sql_default; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── shipping_regions.cidade ──────────────────────────────────────────────────
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'shipping_regions' AND column_name = 'cidade'
);
SET @sql_col = IF(@col_exists = 0,
  'ALTER TABLE shipping_regions ADD COLUMN cidade VARCHAR(120) NULL AFTER uf',
  'SELECT "cidade already exists"');
PREPARE stmt FROM @sql_col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── shipping_regions.cep_prefix ───────────────────────────────────────────────
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'shipping_regions' AND column_name = 'cep_prefix'
);
SET @sql_col = IF(@col_exists = 0,
  'ALTER TABLE shipping_regions ADD COLUMN cep_prefix VARCHAR(5) NULL AFTER cidade',
  'SELECT "cep_prefix already exists"');
PREPARE stmt FROM @sql_col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── orders.estimated_delivery_min_date ────────────────────────────────────────
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'estimated_delivery_min_date'
);
SET @sql_col = IF(@col_exists = 0,
  'ALTER TABLE orders ADD COLUMN estimated_delivery_min_date DATE NULL AFTER estimated_delivery_max_days',
  'SELECT "estimated_delivery_min_date already exists"');
PREPARE stmt FROM @sql_col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── orders.estimated_delivery_max_date ────────────────────────────────────────
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'estimated_delivery_max_date'
);
SET @sql_col = IF(@col_exists = 0,
  'ALTER TABLE orders ADD COLUMN estimated_delivery_max_date DATE NULL AFTER estimated_delivery_min_date',
  'SELECT "estimated_delivery_max_date already exists"');
PREPARE stmt FROM @sql_col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── holidays (nova) ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS holidays (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  name VARCHAR(120) NOT NULL,
  -- uf/cidade NULL = feriado nacional (vale pra todo mundo).
  -- uf preenchido + cidade NULL = feriado estadual.
  -- uf + cidade preenchidos = feriado municipal.
  uf CHAR(2) NULL,
  cidade VARCHAR(120) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_holiday (date, uf, cidade)
) ENGINE=InnoDB;

-- Seed só dos feriados nacionais de DATA FIXA de 2026 (os móveis —
-- Carnaval, Sexta-feira Santa, Corpus Christi — variam todo ano e ficam
-- pro admin cadastrar na tela de logística, etapa F, pra não arriscar
-- data errada aqui). INSERT IGNORE — idempotente, não duplica se já rodou.
INSERT IGNORE INTO holidays (date, name, uf, cidade) VALUES
  ('2026-01-01', 'Confraternização Universal', NULL, NULL),
  ('2026-04-21', 'Tiradentes', NULL, NULL),
  ('2026-05-01', 'Dia do Trabalho', NULL, NULL),
  ('2026-09-07', 'Independência do Brasil', NULL, NULL),
  ('2026-10-12', 'Nossa Senhora Aparecida', NULL, NULL),
  ('2026-11-02', 'Finados', NULL, NULL),
  ('2026-11-15', 'Proclamação da República', NULL, NULL),
  ('2026-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', NULL, NULL),
  ('2026-12-25', 'Natal', NULL, NULL);

-- ── shipping_settings (nova, singleton) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipping_settings (
  id TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,
  prep_time_days INT UNSIGNED NOT NULL DEFAULT 1,
  margin_days INT UNSIGNED NOT NULL DEFAULT 1,
  -- Ajuste por distância — só entra em ação quando origem E destino têm
  -- lat/lng (etapa 21 + geolocalização do cliente); senão o prazo vem
  -- 100% da tabela shipping_regions, como já é hoje.
  distance_base_fee DECIMAL(10,2) NOT NULL DEFAULT 12.00,
  distance_cost_per_km DECIMAL(10,4) NOT NULL DEFAULT 0.03,
  distance_days_per_500km INT UNSIGNED NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_shipping_settings_singleton CHECK (id = 1)
) ENGINE=InnoDB;

INSERT IGNORE INTO shipping_settings (id) VALUES (1);

-- Confirma o resultado.
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'origins' AND column_name = 'is_default') AS origins_is_default_ok,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'shipping_regions' AND column_name = 'cidade') AS regions_cidade_ok,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'shipping_regions' AND column_name = 'cep_prefix') AS regions_cep_ok,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'estimated_delivery_min_date') AS orders_min_date_ok,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'estimated_delivery_max_date') AS orders_max_date_ok,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'holidays') AS holidays_ok,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'shipping_settings') AS settings_ok;
