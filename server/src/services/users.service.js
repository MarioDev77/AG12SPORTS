'use strict';

const { pool } = require('../db/pool');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const BCRYPT_ROUNDS = 12;

function normalizeCpf(cpfRaw) {
  return cpfRaw.replace(/[\.\-\s]/g, '');
}

function hashCpf(cpf) {
  return crypto
    .createHmac('sha256', process.env.CPF_PEPPER)
    .update(normalizeCpf(cpf))
    .digest('hex');
}

/**
 * Registra novo usuário (role = 'user').
 * Retorna { id, username, email, name }.
 * Lança 409 se username/email já existir.
 */
async function registerUser({ name, username, email, password, cpf, phone }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const cpfHash = cpf ? hashCpf(cpf) : null;

  try {
    const [result] = await pool.execute(
      `INSERT INTO users (name, username, email, password_hash, cpf_hash, phone, role, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 'user', 1)`,
      [name, username, email.toLowerCase(), passwordHash, cpfHash, phone ?? null]
    );
    return { id: result.insertId, username, email, name };
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const conflict = new Error('Username or email already in use');
      conflict.status = 409;
      throw conflict;
    }
    throw err;
  }
}

/**
 * Busca usuário por username ou email para login.
 * Retorna row completa (com password_hash) ou null.
 */
async function findUserForLogin(usernameOrEmail) {
  const [rows] = await pool.query(
    `SELECT id, name, username, email, password_hash, role, is_active
     FROM users
     WHERE (username = ? OR email = ?) AND is_active = 1
     LIMIT 1`,
    [usernameOrEmail, usernameOrEmail.toLowerCase()]
  );
  return rows[0] || null;
}

/**
 * Retorna perfil público do usuário (sem password_hash).
 */
async function getUserById(id) {
  const [rows] = await pool.query(
    `SELECT id, name, username, email, phone, role, created_at
     FROM users WHERE id = ? AND is_active = 1 LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Atualiza campos permitidos do perfil.
 */
async function updateUserProfile(id, { name, phone }) {
  const fields = [];
  const values = [];
  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (phone !== undefined) { fields.push('phone = ?'); values.push(phone); }
  if (!fields.length) return;
  values.push(id);
  await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
}

module.exports = { registerUser, findUserForLogin, getUserById, updateUserProfile };
