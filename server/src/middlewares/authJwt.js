'use strict';

const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');

/**
 * authJwt — verifica Bearer token JWT.
 *
 * Melhorias de segurança vs versão original:
 *  - Algoritmo fixado em HS256 (evita "none" e confusão RS/HS)
 *  - audience + issuer opcionais via env (ativados se definidos)
 *  - Mensagens de erro genéricas (não vaza motivo específico)
 */
async function authJwt(req, res, next) {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = parts[1];

  // Rejeita tokens obviamente malformados antes de chamar jwt.verify
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const verifyOptions = {
      algorithms: ['HS256'], // Nunca aceitar "none" ou algoritmos assimétricos aqui
  };
  if (process.env.JWT_ISSUER) verifyOptions.issuer = process.env.JWT_ISSUER;
  if (process.env.JWT_AUDIENCE) verifyOptions.audience = process.env.JWT_AUDIENCE;

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, verifyOptions);
  } catch {
    // Não vaza motivo (expirado, inválido, algoritmo errado…)
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // The environment-backed admin has no users-table row. Database users,
  // however, must still be active and retain the role in their signed token.
  // This makes disabling or demoting an account revoke existing sessions.
  if (payload.sub === 'admin' && payload.role === 'admin') {
    req.user = payload;
    return next();
  }
  if (!/^\d+$/.test(String(payload.sub || ''))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT role, is_active FROM users WHERE id = ? LIMIT 1',
      [String(payload.sub)]
    );
    const account = rows[0];
    if (!account || !account.is_active || account.role !== payload.role) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = { ...payload, role: account.role };
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { authJwt };
