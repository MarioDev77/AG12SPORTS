'use strict';

/**
 * security.js — utilitários de segurança centralizados
 *
 * Cobre:
 *  - Sanitização XSS (escaping HTML/JS em strings)
 *  - Validação/normalização de tipos primitivos
 *  - Geração de tokens IDOR-safe (IDs opacos)
 *  - Verificação de ownership para IDOR
 */

const crypto = require('crypto');

// ─── XSS ────────────────────────────────────────────────────────────────────

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escapa caracteres HTML/JS em uma string.
 * Use para qualquer dado de usuário que seja refletido em resposta HTML.
 * Para respostas JSON puras o Express já serializa corretamente,
 * mas usamos aqui para snapshots armazenados em DB.
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"'`=/]/g, (c) => HTML_ESCAPES[c] || c);
}

/**
 * Sanitiza recursivamente um objeto/array de strings.
 * Útil para sanitizar req.body inteiro antes de persistir.
 * Preserva números, booleans e null/undefined.
 */
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return escapeHtml(obj);
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[escapeHtml(k)] = sanitizeObject(v);
    }
    return out;
  }
  return obj;
}

// ─── SQL Injection helpers ───────────────────────────────────────────────────

/**
 * Garante que um valor inteiro recebido do usuário seja um inteiro positivo válido.
 * Lança se inválido — use no início de cada handler que aceite IDs.
 */
function parsePositiveInt(value, fieldName = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > 2_147_483_647) {
    const err = new Error(`Invalid ${fieldName}: must be a positive integer`);
    err.status = 400;
    throw err;
  }
  return n;
}

/**
 * Normaliza e valida strings de enumeração contra um Set de valores permitidos.
 * Retorna o valor normalizado ou lança 400.
 */
function parseEnum(value, allowed, fieldName = 'field') {
  const v = String(value || '').trim().toLowerCase();
  if (!allowed.has(v)) {
    const err = new Error(`Invalid ${fieldName}`);
    err.status = 400;
    throw err;
  }
  return v;
}

// ─── IDOR — tokens opacos ────────────────────────────────────────────────────

/**
 * Gera um token HMAC-SHA256 para um recurso, associando o ID numérico
 * ao userId do dono. O token pode ser enviado ao cliente no lugar do ID
 * para rotas que exijam ownership (ex: GET /api/orders/:token).
 *
 * Layout: base64url( hmac_sha256( secret, `${resource}:${ownerId}:${resourceId}` ) )
 *         + "." + base64url( payload )
 *
 * Não é um JWT — é só um token opaco de lookup.
 */
function generateOwnershipToken(resourceName, ownerId, resourceId) {
  const secret = process.env.OWNERSHIP_TOKEN_SECRET || process.env.JWT_SECRET;
  const payload = `${resourceName}:${ownerId}:${resourceId}`;
  const sig = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
  const encodedPayload = Buffer.from(payload).toString('base64url');
  return `${sig}.${encodedPayload}`;
}

/**
 * Verifica um ownership token.
 * Retorna { resourceId, ownerId } se válido, lança 403 se não.
 */
function verifyOwnershipToken(token) {
  try {
    const [sig, encodedPayload] = token.split('.');
    if (!sig || !encodedPayload) throw new Error();

    const payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const secret = process.env.OWNERSHIP_TOKEN_SECRET || process.env.JWT_SECRET;

    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64url');

    // Comparação em tempo constante para evitar timing attack
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      throw new Error();
    }

    const [resourceName, ownerId, resourceId] = payload.split(':');
    return { resourceName, ownerId, resourceId: Number(resourceId) };
  } catch {
    const err = new Error('Invalid or tampered token');
    err.status = 403;
    throw err;
  }
}

// ─── Proteção IDOR por role ──────────────────────────────────────────────────

/**
 * Middleware factory: garante que o usuário autenticado seja dono do recurso
 * OU seja admin. O `getOwnerId` é uma função async que recebe req e retorna
 * o userId dono do recurso (number|string).
 *
 * Uso:
 *   router.get('/:id', authJwt, requireOwnerOrAdmin(
 *     async (req) => {
 *       const order = await getOrderById(req.params.id);
 *       return order?.user_id;
 *     }
 *   ), handler);
 */
function requireOwnerOrAdmin(getOwnerId) {
  return async (req, res, next) => {
    try {
      if (req.user?.role === 'admin') return next();
      const ownerId = await getOwnerId(req);
      if (ownerId == null) return res.status(404).json({ error: 'Not found' });
      // eslint-disable-next-line eqeqeq
      if (String(ownerId) !== String(req.user?.sub)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

/**
 * isHttpUrl — true só para URLs absolutas http(s). Bloqueia javascript:, data:,
 * vbscript:, file: etc. (z.string().url() aceita todos eles).
 */
function isHttpUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

module.exports = {
  isHttpUrl,
  escapeHtml,
  sanitizeObject,
  parsePositiveInt,
  parseEnum,
  generateOwnershipToken,
  verifyOwnershipToken,
  requireOwnerOrAdmin,
};
