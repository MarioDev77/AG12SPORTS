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

async function ensureSchema() {
  try {
    await ensureAvailableOnRequest();
  } catch (err) {
    // Não derruba a API: loga e segue (as rotas de produtos vão acusar o erro).
    console.error('[boot] ensureSchema falhou:', err.message);
  }
}

module.exports = { ensureSchema };
