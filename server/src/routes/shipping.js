'use strict';

const express = require('express');
const { z } = require('zod');
const { calculateShippingEstimate } = require('../services/shipping.service');
const { lookupCep } = require('../services/cep.service');

const router = express.Router();

const ShippingSchema = z.object({
  state: z.string().length(2).regex(/^[A-Za-z]{2}$/, 'Estado inválido (use sigla ex: SP)'),
  // Campos opcionais (etapa 22) — refinam a estimativa quando o checkout
  // já tem esses dados; sem eles, cai na regra por UF de sempre.
  cidade: z.string().trim().max(120).optional(),
  cep: z.string().trim().max(9).optional(),
  destinationLat: z.coerce.number().min(-90).max(90).optional(),
  destinationLon: z.coerce.number().min(-180).max(180).optional(),
});

// ─── POST /api/shipping/calculate — prazo/valor de frete a partir da UF ──────
// Mantida por compatibilidade com o checkout atual — MESMO formato de
// resposta de sempre (available/shippingCost/estimatedMinDays/estimatedMaxDays).
// Aceita os campos novos como opcionais: se vierem, o motor novo já usa
// pra refinar por baixo dos panos, sem mudar o contrato desta rota.
router.post('/calculate', async (req, res, next) => {
  try {
    const parsed = ShippingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    }
    const d = parsed.data;
    const result = await calculateShippingEstimate({
      uf: d.state.toUpperCase(),
      cidade: d.cidade,
      cep: d.cep,
      destinationLat: d.destinationLat,
      destinationLon: d.destinationLon,
    });
    if (!result.available) return res.json({ available: false });
    // Formato de sempre + campos novos (datas/confiança) como extra —
    // não remove nada que o checkout atual já espera.
    return res.json({
      available: true,
      shippingCost: result.shippingCost,
      estimatedMinDays: result.estimatedMinDays,
      estimatedMaxDays: result.estimatedMaxDays,
      estimatedMinDate: result.estimatedMinDate,
      estimatedMaxDate: result.estimatedMaxDate,
      confidence: result.confidence,
      method: 'standard',
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// ─── POST /api/shipping/estimate — prévia rica, por CEP ──────────────────────
// Igual ao /calculate, mas pensada pra ser chamada só com o CEP (sem
// esperar o formulário de endereço inteiro) — resolve cidade/UF via
// CepService antes de calcular. Nunca persiste nada.
const EstimateSchema = z.object({
  cep: z.string().trim().min(8).max(9),
  shippingMethod: z.enum(['economico', 'normal', 'rapido', 'express']).optional().default('normal'),
  destinationLat: z.coerce.number().min(-90).max(90).optional(),
  destinationLon: z.coerce.number().min(-180).max(180).optional(),
});

router.post('/estimate', async (req, res, next) => {
  try {
    const parsed = EstimateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    }
    const d = parsed.data;
    const digits = d.cep.replace(/\D/g, '');

    let address;
    try {
      address = await lookupCep(digits);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message || 'CEP inválido.' });
    }

    const result = await calculateShippingEstimate({
      uf: address.uf,
      cidade: address.cidade,
      cep: digits,
      destinationLat: d.destinationLat,
      destinationLon: d.destinationLon,
    });

    if (!result.available) return res.json({ available: false });
    return res.json({ ...result, method: d.shippingMethod });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

module.exports = router;
