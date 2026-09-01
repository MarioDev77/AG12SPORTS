'use strict';

const express = require('express');
const { reverseGeocode } = require('../services/geo.service');

const router = express.Router();

// ─── GET /api/geo/reverse?lat=..&lon=.. — sugestão de endereço a partir da ──
// localização do navegador (sem autenticação). Não persiste nada — é só um
// proxy validado para o Nominatim via GeoService, no mesmo padrão do /cep.
router.get('/reverse', async (req, res, next) => {
  try {
    const address = await reverseGeocode(req.query.lat, req.query.lon);
    return res.json(address);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

module.exports = router;
