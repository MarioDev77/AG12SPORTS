'use strict';

const express = require('express');
const { z } = require('zod');

const { listProducts, getProductById, getFilterMeta } = require('../services/products.service');
const { getReviewsByProduct, createReview } = require('../services/reviews.service');
const { parsePositiveInt } = require('../utils/security');
const { authJwt } = require('../middlewares/authJwt');
const { getUserById } = require('../services/users.service');

const router = express.Router();

// ─── Parâmetros de query aceitos (whitelist) ──────────────────────────────────
const VALID_CATEGORIES = new Set(['all', 'society', 'futsal', 'campo', 'tenis', 'acessorios', 'blusas', 'kits', 'chuteiras']);
const VALID_SORT = new Set(['price_asc', 'price_desc', 'name_asc', 'newest']);

const ProductQuerySchema = z.object({
  category: z.string().max(40).optional(),
  sort:     z.string().max(20).optional(),
  q:        z.string().max(100).optional(), // busca por nome (novo)
  page:     z.coerce.number().int().min(1).max(1000).optional().default(1),
  limit:    z.coerce.number().int().min(1).max(100).optional().default(12),
  brand:    z.string().max(80).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  size:     z.string().max(10).optional(),
  fulfillment: z.enum(['pronta', 'encomenda']).optional(),
});

// ─── GET /api/products/meta — dados p/ montar os filtros do catálogo ────────
// Registrada antes de /:id para não ser capturada pela rota de detalhe.
router.get('/meta', async (req, res, next) => {
  try {
    const meta = await getFilterMeta();
    return res.json(meta);
  } catch (err) {
    return next(err);
  }
});

// ─── GET /api/products ────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const parsed = ProductQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters' });
    }

    const { category, sort, q, page, limit, brand, minPrice, maxPrice, size, fulfillment } = parsed.data;

    const safeCategory = VALID_CATEGORIES.has(category) ? category : 'all';
    const safeSort     = VALID_SORT.has(sort) ? sort : 'newest';

    const { products, total, hasMore } = await listProducts({
      category: safeCategory,
      sort:     safeSort,
      q:        q || '',
      page,
      limit,
      brand:    brand || '',
      minPrice,
      maxPrice,
      size:     size || '',
      fulfillment: fulfillment || '',
    });

    return res.json({ products, total, hasMore, page, limit });
  } catch (err) {
    return next(err);
  }
});

// ─── GET /api/products/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id, 'product id');
    const product = await getProductById(id);
    if (!product) return res.status(404).json({ error: 'Not found' });
    return res.json({ product });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// ─── GET /api/products/:id/reviews ───────────────────────────────────────────
// Rota pública — retorna avaliações aprovadas de um produto
router.get('/:id/reviews', async (req, res, next) => {
  try {
    const id      = parsePositiveInt(req.params.id, 'product id');
    const page    = Math.max(1, Number(req.query.page)  || 1);
    const limit   = Math.min(20, Math.max(1, Number(req.query.limit) || 5));
    const reviews = await getReviewsByProduct(id, { page, limit });
    return res.json(reviews);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// ─── POST /api/products/:id/reviews ──────────────────────────────────────────
// Rota autenticada — cliente logado envia avaliação
const ReviewSchema = z.object({
  rating:  z.number().int().min(1).max(5),
  comment: z.string().min(3).max(800).optional(),
});

router.post('/:id/reviews', authJwt, async (req, res, next) => {
  try {
    const productId = parsePositiveInt(req.params.id, 'product id');

    const parsed = ReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.issues });
    }

    // O JWT só carrega { sub, role } — nunca teve req.user.id/name (esses
    // campos sempre vieram undefined aqui, o que quebrava o INSERT porque
    // mysql2 rejeita bind params undefined). Busca o nome real no banco.
    if (req.user.role === 'admin') {
      return res.status(403).json({ error: 'Admin não pode avaliar produtos' });
    }
    const userId = Number(req.user.sub);
    const reviewer = await getUserById(userId);
    if (!reviewer) return res.status(404).json({ error: 'User not found' });

    const review = await createReview({
      productId,
      userId,
      nameSnapshot: reviewer.name || 'Cliente',
      rating:       parsed.data.rating,
      comment:      parsed.data.comment || null,
    });

    return res.status(201).json({ review });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

module.exports = router;