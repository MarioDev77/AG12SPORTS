'use strict';

// ─── HolidaysService ────────────────────────────────────────────────────────
// Responsabilidade única: dizer se uma data é feriado (nacional, estadual
// ou municipal) — usado pelo addBusinessDays() do ShippingService pra não
// contar feriado como dia útil.

const { pool } = require('../db/pool');

function toDateKey(date) {
  // Sempre compara por data (sem hora), no fuso do servidor.
  return date.toISOString().slice(0, 10);
}

/**
 * Retorna true se `date` for feriado nacional, ou estadual/municipal pra
 * o uf/cidade informados. Feriado nacional (uf e cidade NULL) vale sempre.
 */
async function isHoliday(date, { uf = null, cidade = null } = {}) {
  const dateKey = toDateKey(date);
  const [rows] = await pool.query(
    `SELECT id FROM holidays
     WHERE active = 1 AND date = ?
       AND (
         (uf IS NULL AND cidade IS NULL)
         OR (uf = ? AND cidade IS NULL)
         OR (uf = ? AND cidade = ?)
       )
     LIMIT 1`,
    [dateKey, uf, uf, cidade]
  );
  return rows.length > 0;
}

async function listHolidays({ year } = {}) {
  const params = [];
  let where = '';
  if (year) {
    where = 'WHERE YEAR(date) = ?';
    params.push(year);
  }
  const [rows] = await pool.query(
    `SELECT id, date, name, uf, cidade, active FROM holidays ${where} ORDER BY date ASC`,
    params
  );
  return rows;
}

module.exports = { isHoliday, listHolidays };
