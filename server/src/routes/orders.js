'use strict';

const express = require('express');
const { z } = require('zod');

const { createOrder, getOrderByIdAndUser, getOrdersByUser } = require('../services/orders.service');
const { authJwt } = require('../middlewares/authJwt');
const { parsePositiveInt } = require('../utils/security');

const router = express.Router();

// ─── Schema de criação de pedido ──────────────────────────────────────────────
// NOTA DE SEGURANÇA: unitPrice, frete e totais enviados pelo cliente são
// IGNORADOS pelo service — o servidor recalcula tudo consultando o DB.
// O schema ainda valida a estrutura para rejeitar payloads malformados cedo.
const OrderSchema = z.object({
  customer: z.object({
    name: z.string().min(3).max(120),
    cpf: z.string().min(11).max(14).regex(/^[\d.\-]+$/, 'CPF inválido'),
    email: z.string().email().max(120),
    phone: z.string().min(8).max(20).regex(/^[\d\s()\-+]+$/, 'Telefone inválido'),
  }),
  address: z.object({
    cep: z.string().min(8).max(9).regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
    street: z.string().min(3).max(160),
    number: z.string().min(1).max(20).regex(/^[\w\s\-/]+$/, 'Número inválido'),
    complement: z.string().max(80).optional().nullable(),
    bairro: z.string().min(2).max(120),
    city: z.string().min(2).max(120),
    state: z.string().length(2).regex(/^[A-Z]{2}$/, 'Estado inválido (use sigla ex: SP)'),
  }),
  payment: z.object({
    method: z.enum(['pix', 'cartao', 'boleto']),
  }),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive().max(2_147_483_647),
        size: z.union([z.string().min(1).max(10), z.number().int().positive()]).transform(String),
        qty: z.number().int().positive().max(10),
        // unitPrice do cliente é recebido mas NUNCA usado no cálculo — só log
        unitPrice: z.number().positive().optional(),
      })
    )
    .min(1)
    .max(20),
});

// ─── POST /api/orders — criar pedido (requer auth) ────────────────────────────
router.post('/', authJwt, async (req, res, next) => {
  try {
    const parsed = OrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    }

    const result = await createOrder(parsed.data, req.user.sub);
    return res.status(201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// ─── GET /api/orders — lista os pedidos do PRÓPRIO cliente autenticado ────────
// (a listagem de TODOS os pedidos, para o admin, fica em /manage/orders)
router.get('/', authJwt, async (req, res, next) => {
  try {
    const orders = await getOrdersByUser(req.user.sub);
    return res.json({ orders });
  } catch (err) {
    return next(err);
  }
});

// ─── GET /api/orders/:id — ver pedido (IDOR: só dono ou admin) ────────────────
router.get('/:id', authJwt, async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id, 'order id');

    const order = await getOrderByIdAndUser(id);
    if (!order) return res.status(404).json({ error: 'Not found' });

    const isAdmin = req.user?.role === 'admin';
    const isOwner = String(order.user_id) === String(req.user?.sub);

    if (!isAdmin && !isOwner) {
      // Retorna 404 propositalmente — não confirma que o recurso existe
      return res.status(404).json({ error: 'Not found' });
    }

    // Cliente não vê o pedido (nem por ID direto) enquanto o admin não
    // confirmar o pagamento — mesma regra da listagem em getOrdersByUser.
    if (!isAdmin && order.status === 'pending') {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.json({ order });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

module.exports = router;
