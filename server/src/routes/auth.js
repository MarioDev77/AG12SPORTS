'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { z } = require('zod');

const { registerUser, findUserForLogin } = require('../services/users.service');
const { authJwt } = require('../middlewares/authJwt');
const { getUserById, updateUserProfile } = require('../services/users.service');

const router = express.Router();

// ─── Helpers de JWT ──────────────────────────────────────────────────────────
function signToken(payload) {
  const opts = { algorithm: 'HS256', expiresIn: '2h' };
  if (process.env.JWT_ISSUER) opts.issuer = process.env.JWT_ISSUER;
  if (process.env.JWT_AUDIENCE) opts.audience = process.env.JWT_AUDIENCE;
  return jwt.sign(payload, process.env.JWT_SECRET, opts);
}

// ─── Schemas ──────────────────────────────────────────────────────────────────
const RegisterSchema = z.object({
  name: z.string().min(2).max(120),
  username: z.string().min(3).max(80).regex(/^[\w@.\-]+$/, 'Username inválido'),
  email: z.string().email().max(120),
  password: z.string().min(8).max(120),
  cpf: z.string().min(11).max(14).regex(/^[\d.\-]+$/).optional(),
  phone: z.string().min(8).max(20).regex(/^[\d\s()\-+]+$/).optional(),
});

const LoginSchema = z.object({
  username: z.string().min(1).max(120), // aceita username ou email
  password: z.string().min(1).max(120),
});

const UpdateMeSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().min(8).max(20).regex(/^[\d\s()\-+]+$/).optional(),
});

// ─── POST /api/auth/register ─────────────────────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });

    const user = await registerUser(parsed.data);
    const token = signToken({ sub: String(user.id), role: 'user' });
    return res.status(201).json({ token, expiresIn: 7200, user: { id: user.id, username: user.username, email: user.email, name: user.name } });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(401).json({ error: 'Invalid credentials' });

    const { username, password } = parsed.data;
    // ── Tenta admin fixo primeiro ────────────────────────────────────────────
    const adminUser = process.env.ADMIN_USER;
    const adminHash = process.env.ADMIN_PASS_HASH;

    if (adminUser && adminHash) {
      const usernameBytes = Buffer.from(username);
      const adminBytes = Buffer.from(adminUser);
      const usernameMatch = usernameBytes.length === adminBytes.length
        && crypto.timingSafeEqual(usernameBytes, adminBytes);
      const dummyHash = '$2a$12$invalidhashpaddingtomakeitconstantlength000000000000';
      const ok = await bcrypt.compare(password, usernameMatch ? adminHash : dummyHash);

      if (usernameMatch && ok) {
        const token = signToken({ sub: 'admin', role: 'admin' });
        return res.json({ token, expiresIn: 7200, user: { username: adminUser, role: 'admin' } });
      }
    }

    // ── Tenta usuário do banco ───────────────────────────────────────────────
    const dbUser = await findUserForLogin(username);
    const dummyHash2 = '$2a$12$invalidhashpaddingtomakeitconstantlength000000000000';
    const hashToCheck = dbUser ? dbUser.password_hash : dummyHash2;
    const ok2 = await bcrypt.compare(password, hashToCheck);

    if (!dbUser || !ok2) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken({ sub: String(dbUser.id), role: dbUser.role });
    return res.json({
      token,
      expiresIn: 7200,
      user: { id: dbUser.id, username: dbUser.username, email: dbUser.email, name: dbUser.name, role: dbUser.role },
    });
  } catch (err) {
    return next(err);
  }
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', authJwt, async (req, res, next) => {
  try {
    if (req.user.role === 'admin')
      return res.json({ user: { username: process.env.ADMIN_USER, role: 'admin' } });

    const user = await getUserById(Number(req.user.sub));
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user });
  } catch (err) {
    return next(err);
  }
});

// ─── PATCH /api/auth/me ───────────────────────────────────────────────────────
router.patch('/me', authJwt, async (req, res, next) => {
  try {
    if (req.user.role === 'admin')
      return res.status(403).json({ error: 'Admin profile is managed via env' });

    const parsed = UpdateMeSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });

    await updateUserProfile(Number(req.user.sub), parsed.data);
    const user = await getUserById(Number(req.user.sub));
    return res.json({ user });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
