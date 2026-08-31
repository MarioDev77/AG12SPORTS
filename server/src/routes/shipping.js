'use strict';

const express = require('express');
const { z } = require('zod');
const { calculateShipping } = require('../services/shipping.service');

const router = express.Router();

const ShippingSchema = z.object({
  state: z.string().length(2).regex(/^[A-Za-z]{2}$/, 'Estado inválido (use sigla ex: SP)'),
});

// ─── POST /api/shipping/calculate — prazo/valor de frete a partir da UF ──────
// Não recebe preço nem total do cliente — só o estado, pra estimar o frete
// antes do pedido existir (usado na etapa "Entrega" do checkout).
router.post('/calculate', async (req, res, next) => {
  try {
    const parsed = ShippingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    }
    const result = await calculateShipping(parsed.data.state.toUpperCase());
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

module.exports = router;
