'use strict';

const { pool } = require('../db/pool');

// ─── ShippingService ────────────────────────────────────────────────────────
// Responsabilidade única: calcular prazo e valor de frete a partir do
// endereço do cliente. Hoje é uma regra simples por estado (shipping_regions),
// mas a assinatura de calculateShipping(uf, items) foi pensada pra ser fácil
// de trocar depois por uma API real de transportadora sem mudar quem chama.
//
// IMPORTANTE: nunca calcular datas fixas aqui — só quantidade de dias.
// Quem transforma "min/max dias" em datas de calendário é o frontend,
// a partir da data atual (evita hardcode de data no backend/frontend).

async function calculateShipping(uf) {
  const safeUf = String(uf || '').trim().toUpperCase();

  const [rows] = await pool.query(
    'SELECT delivery_min_days, delivery_max_days, shipping_cost FROM shipping_regions WHERE uf = ? AND active = 1 LIMIT 1',
    [safeUf]
  );

  let region = rows[0];
  if (!region) {
    const [fallbackRows] = await pool.query(
      "SELECT delivery_min_days, delivery_max_days, shipping_cost FROM shipping_regions WHERE uf = '*' AND active = 1 LIMIT 1"
    );
    region = fallbackRows[0];
  }

  if (!region) {
    // Não há nem regra específica nem fallback ativo — região não atendida.
    return { available: false };
  }

  return {
    available: true,
    shippingCost: Number(region.shipping_cost),
    estimatedMinDays: region.delivery_min_days,
    estimatedMaxDays: region.delivery_max_days,
    method: 'standard',
  };
}

module.exports = { calculateShipping };
