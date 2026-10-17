'use strict';

const { pool } = require('./pool');

/**
 * Garante a coluna products.available_on_request (encomenda / "Disponível
 * para pedidos") no banco ao qual a API está conectada. Idempotente: se a
 * coluna já existe, não faz nada. O backfill (produtos sem pronta entrega
 * viram encomenda) roda só quando a coluna acabou de ser criada.
 */
async function ensureAvailableOnRequest() {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'products'
        AND column_name = 'available_on_request'`
  );
  if (Number(rows[0].c) > 0) return;

  await pool.query(
    'ALTER TABLE products ADD COLUMN available_on_request TINYINT(1) NOT NULL DEFAULT 0 AFTER available_for_order'
  );
  await pool.query('UPDATE products SET available_on_request = 1 WHERE available_for_order = 0');
  console.log('[boot] Coluna products.available_on_request criada e preenchida');
}

/**
 * Cadastro de marcas (admin cria e seleciona ao cadastrar produto).
 * Idempotente. Na criação da tabela, importa as marcas que já existem nos
 * produtos e acrescenta as marcas fixas da loja.
 */
async function ensureBrandsTable() {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'brands'`
  );
  if (Number(rows[0].c) > 0) return;

  await pool.query(
    `CREATE TABLE brands (
       id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
       name VARCHAR(80) NOT NULL,
       created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       UNIQUE KEY uq_brands_name (name)
     )`
  );
  await pool.query(
    `INSERT IGNORE INTO brands (name)
     SELECT DISTINCT TRIM(brand) FROM products WHERE TRIM(brand) <> ''`
  );
  for (const name of ['Nike', 'Adidas', 'Puma', 'Mizuno']) {
    await pool.query('INSERT IGNORE INTO brands (name) VALUES (?)', [name]);
  }
  console.log('[boot] Tabela brands criada e preenchida');
}

async function ensureSchema() {
  for (const step of [ensureAvailableOnRequest, ensureBrandsTable]) {
    try {
      await step();
    } catch (err) {
      // Não derruba a API: loga e segue (cada etapa é independente).
      console.error(`[boot] ensureSchema (${step.name}) falhou:`, err.message);
    }
  }
}

module.exports = { ensureSchema };
