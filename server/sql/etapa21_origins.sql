-- ============================================================
-- ETAPA 21 — Depósitos/origens de envio
-- ============================================================
-- Migration ADITIVA — não apaga nem altera dados existentes.
--
-- origins: cadastro de depósitos/fornecedores de onde os pedidos podem
-- sair. O admin escolhe, pedido a pedido, de qual origem aquele pedido
-- foi despachado (ver etapa 22 — coluna orders.origin_id). Latitude e
-- longitude são preenchidas automaticamente por geocoding no backend
-- (a partir do endereço) e usadas depois no cálculo de frete por
-- distância (etapa 23) — ficam NULL se o geocoding falhar, sem travar
-- o cadastro.
--
-- CREATE TABLE IF NOT EXISTS é nativamente idempotente, então não
-- precisa do padrão information_schema usado pra ADD COLUMN.
-- ============================================================

USE pitch_futebol;

CREATE TABLE IF NOT EXISTS origins (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,

  cep VARCHAR(9) NOT NULL,
  logradouro VARCHAR(160) NOT NULL,
  numero VARCHAR(20) NOT NULL,
  complemento VARCHAR(80) NULL,
  bairro VARCHAR(120) NOT NULL,
  cidade VARCHAR(120) NOT NULL,
  uf CHAR(2) NOT NULL,

  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,

  active TINYINT(1) NOT NULL DEFAULT 1,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_origins_active (active)
) ENGINE=InnoDB;

-- Confirma o resultado.
SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'origins') AS origins_ok;
