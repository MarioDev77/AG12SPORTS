'use strict';

const express = require('express');
const { lookupCep } = require('../services/cep.service');

const router = express.Router();

// ─── GET /api/cep/:cep — consulta pública de CEP (sem autenticação) ──────────
// Não persiste nada — é só um proxy validado para o ViaCEP via CepService.
router.get('/:cep', async (req, res, next) => {
  try {
    const address = await lookupCep(req.params.cep);
    return res.json(address);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

module.exports = router;
