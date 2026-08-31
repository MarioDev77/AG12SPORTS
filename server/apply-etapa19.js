'use strict';
// Aplica a migration da ETAPA 19 (addresses, shipping_regions, orders,
// order_items) — não apaga nem altera dados existentes.
const fs = require('fs');
const path = require('path');
const { getScriptConnection } = require('./scripts/db-connection');

async function run() {
  const conn = await getScriptConnection();
  console.log('Conectado!');

  const sql = fs.readFileSync(path.join(__dirname, 'sql/etapa19_orders_checkout.sql'), 'utf8');
  const [results] = await conn.query(sql);

  const lastResult = Array.isArray(results) ? results[results.length - 1] : results;
  console.log('✅ Etapa 19 aplicada — addresses, shipping_regions, orders e order_items prontas.');
  console.table(lastResult);

  await conn.end();
}

run().catch(console.error);
