'use strict';

// ─── OriginsService ───────────────────────────────────────────────────────
// CRUD de depósitos/origens de envio (etapa 21). Cada origem tem um
// endereço completo; latitude/longitude são calculadas automaticamente
// via geocoding (GeoService) a partir desse endereço, tanto na criação
// quanto quando o endereço é editado — o admin nunca digita coordenada
// na mão.

const { pool } = require('../db/pool');
const { forwardGeocode } = require('./geo.service');

function buildAddressQuery({ logradouro, numero, cidade, uf, cep }) {
  return `${logradouro}, ${numero}, ${cidade} - ${uf}, ${cep}, Brasil`;
}

function mapRow(row) {
  return {
    id: row.id,
    name: row.name,
    cep: row.cep,
    logradouro: row.logradouro,
    numero: row.numero,
    complemento: row.complemento,
    bairro: row.bairro,
    cidade: row.cidade,
    uf: row.uf,
    latitude: row.latitude !== null ? Number(row.latitude) : null,
    longitude: row.longitude !== null ? Number(row.longitude) : null,
    active: !!row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listOrigins({ onlyActive = false } = {}) {
  const where = onlyActive ? 'WHERE active = 1' : '';
  const [rows] = await pool.query(
    `SELECT * FROM origins ${where} ORDER BY active DESC, name ASC`
  );
  return rows.map(mapRow);
}

async function getOriginById(id) {
  const [rows] = await pool.query('SELECT * FROM origins WHERE id = ? LIMIT 1', [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}

async function createOrigin(data) {
  const { latitude, longitude } = await forwardGeocode(buildAddressQuery(data));

  const [result] = await pool.execute(
    `INSERT INTO origins (name, cep, logradouro, numero, complemento, bairro, cidade, uf, latitude, longitude)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name, data.cep, data.logradouro, data.numero, data.complemento ?? null,
      data.bairro, data.cidade, data.uf, latitude, longitude,
    ]
  );
  return getOriginById(result.insertId);
}

async function updateOrigin(id, data) {
  const current = await getOriginById(id);
  if (!current) return null;

  const merged = { ...current, ...data };

  // Só re-geocodifica se algum campo de endereço realmente mudou — evita
  // bater no Nominatim à toa quando o admin só está renomeando o depósito
  // ou ativando/desativando.
  const addressChanged = ['cep', 'logradouro', 'numero', 'cidade', 'uf'].some(
    (field) => data[field] !== undefined && data[field] !== current[field]
  );

  let latitude = current.latitude;
  let longitude = current.longitude;
  if (addressChanged) {
    const geocoded = await forwardGeocode(buildAddressQuery(merged));
    latitude = geocoded.latitude;
    longitude = geocoded.longitude;
  }

  await pool.execute(
    `UPDATE origins SET name = ?, cep = ?, logradouro = ?, numero = ?, complemento = ?,
            bairro = ?, cidade = ?, uf = ?, latitude = ?, longitude = ?, active = ?
     WHERE id = ?`,
    [
      merged.name, merged.cep, merged.logradouro, merged.numero, merged.complemento ?? null,
      merged.bairro, merged.cidade, merged.uf, latitude, longitude, merged.active ? 1 : 0,
      id,
    ]
  );
  return getOriginById(id);
}

async function deleteOrigin(id) {
  try {
    const [result] = await pool.execute('DELETE FROM origins WHERE id = ?', [id]);
    return result.affectedRows > 0;
  } catch (err) {
    // FK constraint (1451) — origem já usada em algum pedido (etapa 22).
    if (err.errno === 1451) {
      const e = new Error('Este depósito já foi usado em pedidos e não pode ser excluído — desative-o em vez disso.');
      e.status = 409;
      throw e;
    }
    throw err;
  }
}

module.exports = { listOrigins, getOriginById, createOrigin, updateOrigin, deleteOrigin };
