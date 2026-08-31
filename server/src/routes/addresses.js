'use strict';

const express = require('express');
const { z } = require('zod');

const { authJwt } = require('../middlewares/authJwt');
const { parsePositiveInt } = require('../utils/security');
const { pool } = require('../db/pool');

const router = express.Router();
router.use(authJwt);

const AddressSchema = z.object({
  cep: z.string().min(8).max(9).regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
  logradouro: z.string().min(3).max(160),
  numero: z.string().min(1).max(20).regex(/^[\w\s\-/]+$/, 'Número inválido'),
  complemento: z.string().max(80).optional().nullable(),
  bairro: z.string().min(2).max(120),
  cidade: z.string().min(2).max(120),
  uf: z.string().length(2).regex(/^[A-Z]{2}$/, 'Estado inválido (use sigla ex: SP)'),
  isDefault: z.boolean().optional().default(false),
});

// ─── GET /api/addresses — lista os endereços do cliente autenticado ──────────
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, cep, logradouro, numero, complemento, bairro, cidade, uf, is_default
       FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC`,
      [req.user.sub]
    );
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

// ─── POST /api/addresses — salva um novo endereço ────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const parsed = AddressSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    const d = parsed.data;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      if (d.isDefault) {
        await conn.execute('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.sub]);
      }
      const [result] = await conn.execute(
        `INSERT INTO addresses (user_id, cep, logradouro, numero, complemento, bairro, cidade, uf, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.sub, d.cep, d.logradouro, d.numero, d.complemento ?? null, d.bairro, d.cidade, d.uf, d.isDefault ? 1 : 0]
      );
      await conn.commit();
      return res.status(201).json({ id: result.insertId, ...d });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (err) {
    return next(err);
  }
});

// ─── PATCH /api/addresses/:id — edita um endereço (IDOR: só o dono) ──────────
router.patch('/:id', async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id, 'address id');
    const parsed = AddressSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    const d = parsed.data;

    const [[existing]] = await pool.query('SELECT id FROM addresses WHERE id = ? AND user_id = ?', [id, req.user.sub]);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const fields = [];
    const values = [];
    const map = { cep: 'cep', logradouro: 'logradouro', numero: 'numero', complemento: 'complemento', bairro: 'bairro', cidade: 'cidade', uf: 'uf' };
    for (const [key, col] of Object.entries(map)) {
      if (d[key] !== undefined) { fields.push(`${col} = ?`); values.push(d[key]); }
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      if (d.isDefault) {
        await conn.execute('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.sub]);
        fields.push('is_default = ?');
        values.push(1);
      }
      if (fields.length) {
        values.push(id);
        await conn.execute(`UPDATE addresses SET ${fields.join(', ')} WHERE id = ?`, values);
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    return res.json({ updated: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// ─── DELETE /api/addresses/:id — remove endereço (IDOR: só o dono) ───────────
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id, 'address id');
    const [result] = await pool.execute('DELETE FROM addresses WHERE id = ? AND user_id = ?', [id, req.user.sub]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    return res.json({ deleted: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

module.exports = router;
