'use strict';

const { authJwt } = require('./authJwt');

/**
 * optionalAuth — autenticação opcional.
 *
 * Sem header Authorization: segue como visitante (req.user fica indefinido).
 * Com header: valida exatamente como o authJwt (mesmas regras e mesmo 401
 * para token inválido/expirado), para quem estiver logado continuar com o
 * pedido vinculado à própria conta.
 */
function optionalAuth(req, res, next) {
  if (!req.headers.authorization) return next();
  return authJwt(req, res, next);
}

module.exports = { optionalAuth };
