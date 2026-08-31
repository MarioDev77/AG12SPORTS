'use strict';
// Aplica a migration da ETAPA 18 (tabela product_variants + coluna
// products.available_for_order) — não apaga nem altera dados existentes.
const fs = require('fs');
const path = require('path');
const { getScriptConnection } = require('./scripts/db-connection');

async function run() {
  const conn = await getScriptConnection();
  console.log('Conectado!');

  const sql = fs.readFileSync(path.join(__dirname, 'sql/etapa18_add_product_variants.sql'), 'utf8');
  const [results] = await conn.query(sql);

  const lastResult = Array.isArray(results) ? results[results.length - 1] : results;
  console.log('✅ Etapa 18 aplicada — product_variants criada e available_for_order adicionada.');
  console.table(lastResult);

  await conn.end();
}

run().catch(console.error);
