'use strict';

/**
 * routes/index.js — agrega todas as sub-rotas da API sob um único router.
 *
 * Este arquivo é montado em /api (ver src/index.js: app.use('/api', apiRouter)).
 *
 * NOTA DE SEGURANÇA (ver SECURITY.md, seção 4):
 *  - O painel de administração é montado em /api/<ADMIN_ROUTE_PREFIX>
 *    (padrão: /manage, configurável via .env) — NUNCA em /admin ou
 *    qualquer caminho óbvio.
 *  - Caminhos comuns de admin usados em varreduras automatizadas
 *    retornam 404 explicitamente, sem revelar se o prefixo real existe.
 */

const express = require('express');

const authRouter = require('./auth');
const productsRouter = require('./products');
const adminRouter = require('./admin');
const ordersRouter = require('./orders');
const cepRouter = require('./cep');
const shippingRouter = require('./shipping');
const addressesRouter = require('./addresses');

const router = express.Router();

// ─── Rotas públicas / autenticadas normais ────────────────────────────────────
router.use('/auth', authRouter);
router.use('/products', productsRouter);
router.use('/orders', ordersRouter);
router.use('/cep', cepRouter);
router.use('/shipping', shippingRouter);
router.use('/addresses', addressesRouter);

// ─── Painel admin — prefixo oculto, configurável via .env ────────────────────
const ADMIN_ROUTE_PREFIX = process.env.ADMIN_ROUTE_PREFIX || '/manage';
router.use(ADMIN_ROUTE_PREFIX, adminRouter);

// ─── Caminhos óbvios de admin — sempre 404, nunca revelam o prefixo real ─────
const DECOY_ADMIN_PATHS = [
  '/admin',
  '/administrator',
  '/wp-admin',
  '/dashboard',
  '/panel',
  '/backoffice',
  '/cp',
  '/controlpanel',
];
router.use(DECOY_ADMIN_PATHS, (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

module.exports = { apiRouter: router };
