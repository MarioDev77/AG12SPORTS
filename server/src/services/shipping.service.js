'use strict';

const { pool } = require('../db/pool');
const { isHoliday } = require('./holidays.service');

// ─── ShippingService ────────────────────────────────────────────────────────
// Motor de estimativa de entrega (etapa 22). Continua com uma única
// responsabilidade — calcular prazo e valor de frete —, mas agora compõe
// várias fontes em vez de só "UF → dias fixos":
//
//   regra de região (cep_prefix > cidade > uf > '*' fallback)
//   + tempo de preparação (shipping_settings)
//   + ajuste por distância real, SÓ quando origem e destino têm lat/lng
//   + margem de segurança (shipping_settings)
//   + dias úteis reais (fins de semana + feriados)
//   = janela de dias E de datas de calendário
//
// calculateShipping(uf) continua existindo com a MESMA assinatura/retorno
// de antes — quem já chama isso (createOrder) não quebra. Quem quiser a
// versão rica (datas, confiança) usa calculateShippingEstimate.
//
// SEGURANÇA: esta função nunca recebe preço/prazo do cliente — só
// endereço. O servidor recalcula tudo sempre, na prévia e na criação do
// pedido (ver orders.service.js).

// ── Datas em UTC (dia cheio, sem hora) — evita bug de fuso horário perto
//    da meia-noite, independente do timezone do servidor. ─────────────────
function toUtcMidnight(d) {
  const date = d instanceof Date ? d : new Date(d);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
function addDaysUtc(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
function isWeekend(date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}
function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Anda `days` dias ÚTEIS a partir de startDate — pula sábado, domingo e
 * feriados (nacionais sempre; estaduais/municipais quando uf/cidade
 * batem). Nunca faz "data + N" direto.
 */
async function addBusinessDays(startDate, days, { uf, cidade } = {}) {
  let cursor = toUtcMidnight(startDate);
  let remaining = Math.max(0, Math.round(days));
  while (remaining > 0) {
    cursor = addDaysUtc(cursor, 1);
    if (isWeekend(cursor)) continue;
    if (await isHoliday(cursor, { uf, cidade })) continue;
    remaining -= 1;
  }
  return cursor;
}

// ── Distância aproximada entre dois pontos (fórmula de haversine) ──────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getSettings() {
  const [rows] = await pool.query('SELECT * FROM shipping_settings WHERE id = 1 LIMIT 1');
  const row = rows[0] || {};
  return {
    prepTimeDays: Number(row.prep_time_days ?? 1),
    marginDays: Number(row.margin_days ?? 1),
    distanceBaseFee: Number(row.distance_base_fee ?? 12),
    distanceCostPerKm: Number(row.distance_cost_per_km ?? 0.03),
    distanceDaysPer500Km: Number(row.distance_days_per_500km ?? 1),
  };
}

async function getDefaultOrigin() {
  const [rows] = await pool.query('SELECT * FROM origins WHERE is_default = 1 AND active = 1 LIMIT 1');
  if (rows[0]) return rows[0];
  // Sem origem marcada como padrão (ex: projeto sem depósito cadastrado
  // ainda) — usa a primeira ativa, se existir, só pro ajuste por
  // distância; se não existir nenhuma, segue sem ajuste (fallback pra
  // regra de região, como já era antes da etapa 21).
  const [fallback] = await pool.query('SELECT * FROM origins WHERE active = 1 ORDER BY id ASC LIMIT 1');
  return fallback[0] || null;
}

/**
 * Busca a regra de frete mais específica disponível.
 * Prioridade: cep_prefix (5 dígitos) > cidade+uf > uf > '*' (padrão).
 */
async function findRegionRule({ uf, cidade, cepDigits }) {
  const safeUf = String(uf || '').trim().toUpperCase();
  const safeCidade = String(cidade || '').trim();
  const prefix5 = cepDigits && cepDigits.length >= 5 ? cepDigits.slice(0, 5) : null;

  if (prefix5) {
    const [rows] = await pool.query(
      'SELECT * FROM shipping_regions WHERE cep_prefix = ? AND active = 1 LIMIT 1',
      [prefix5]
    );
    if (rows[0]) return { region: rows[0], confidence: 'high' };
  }

  if (safeCidade && safeUf) {
    const [rows] = await pool.query(
      'SELECT * FROM shipping_regions WHERE cidade = ? AND uf = ? AND active = 1 LIMIT 1',
      [safeCidade, safeUf]
    );
    if (rows[0]) return { region: rows[0], confidence: 'high' };
  }

  if (safeUf) {
    const [rows] = await pool.query(
      'SELECT * FROM shipping_regions WHERE uf = ? AND cidade IS NULL AND cep_prefix IS NULL AND active = 1 LIMIT 1',
      [safeUf]
    );
    if (rows[0]) return { region: rows[0], confidence: 'medium' };
  }

  const [fallbackRows] = await pool.query(
    "SELECT * FROM shipping_regions WHERE uf = '*' AND active = 1 LIMIT 1"
  );
  if (fallbackRows[0]) return { region: fallbackRows[0], confidence: 'low' };

  return null;
}

/**
 * Assinatura/retorno originais — preservados. Por baixo já usa o motor
 * novo, mas quem chama só com a UF (createOrder de hoje, checkout de
 * hoje) continua recebendo exatamente o mesmo formato de resposta.
 */
async function calculateShipping(uf) {
  const result = await calculateShippingEstimate({ uf });
  if (!result.available) return { available: false };
  return {
    available: true,
    shippingCost: result.shippingCost,
    estimatedMinDays: result.estimatedMinDays,
    estimatedMaxDays: result.estimatedMaxDays,
    method: 'standard',
  };
}

/**
 * Motor completo. Recebe o que tiver disponível — uf é o mínimo; cidade,
 * cep e lat/lng do destino refinam a estimativa quando o checkout manda.
 * Retorna custo + janela de dias + janela de DATAS + nível de confiança.
 */
async function calculateShippingEstimate({ uf, cidade, cep, destinationLat, destinationLon, orderDate }) {
  const cepDigits = cep ? String(cep).replace(/\D/g, '') : null;
  const found = await findRegionRule({ uf, cidade, cepDigits });
  if (!found) return { available: false };

  const { region } = found;
  let confidence = found.confidence;
  const settings = await getSettings();

  let minDays = region.delivery_min_days;
  let maxDays = region.delivery_max_days;
  let shippingCost = Number(region.shipping_cost);

  // Ajuste por distância — só entra quando dá pra calcular de verdade
  // (origem com lat/lng, do cadastro de depósitos, E destino com lat/lng,
  // que só existe quando o cliente usou a localização no checkout).
  // NUNCA reduz o prazo/custo da regra de região — só aumenta quando a
  // distância sugere que deveria ser mais (mais seguro que prometer
  // rápido/barato demais e não cumprir).
  const origin = await getDefaultOrigin();
  const hasDestinationCoords = Number.isFinite(Number(destinationLat)) && Number.isFinite(Number(destinationLon));
  if (origin?.latitude && origin?.longitude && hasDestinationCoords) {
    const km = haversineKm(
      Number(origin.latitude), Number(origin.longitude),
      Number(destinationLat), Number(destinationLon)
    );
    const distanceDays = Math.max(1, Math.ceil((km / 500) * settings.distanceDaysPer500Km));
    const distanceCost = settings.distanceBaseFee + km * settings.distanceCostPerKm;

    minDays = Math.max(minDays, distanceDays);
    maxDays = Math.max(maxDays, distanceDays + 1);
    shippingCost = Math.max(shippingCost, Number(distanceCost.toFixed(2)));
    confidence = 'high';
  }

  const start = orderDate ? new Date(orderDate) : new Date();
  const minDate = await addBusinessDays(start, settings.prepTimeDays + minDays, { uf, cidade });
  const maxDate = await addBusinessDays(start, settings.prepTimeDays + maxDays + settings.marginDays, { uf, cidade });

  return {
    available: true,
    shippingCost,
    estimatedMinDays: minDays + settings.prepTimeDays,
    estimatedMaxDays: maxDays + settings.prepTimeDays + settings.marginDays,
    estimatedMinDate: toDateKey(minDate),
    estimatedMaxDate: toDateKey(maxDate),
    confidence,
  };
}

module.exports = { calculateShipping, calculateShippingEstimate, addBusinessDays, haversineKm };
