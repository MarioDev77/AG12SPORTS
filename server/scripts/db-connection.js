'use strict';

const mysql = require('mysql2/promise');
const path = require('path');

// Carrega server/.env independentemente de onde o script for chamado.
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

/**
 * Mesma lógica de resolução do src/db/pool.js (3 cenários, nessa ordem),
 * mas usada por scripts standalone (seed.js, apply-etapaN.js) que rodam
 * fora do Express e precisam de multipleStatements:true para aplicar
 * arquivos .sql inteiros de uma vez.
 *
 * 1) MYSQL_URL / DATABASE_URL — connection string completa
 * 2) MYSQLHOST / MYSQLPORT / MYSQLUSER / MYSQLPASSWORD / MYSQLDATABASE
 * 3) DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
 *
 * As credenciais reais ficam só no server/.env (git-ignored) — nunca
 * neste arquivo nem em nenhum script que sobe para o repositório.
 */
function resolveConfig() {
  const connectionString = process.env.MYSQL_URL || process.env.DATABASE_URL;

  const wantsSsl = (host) => {
    const isLocal = ['localhost', '127.0.0.1', 'db', 'mysql'].includes((host || '').toLowerCase());
    if (process.env.DB_SSL === 'false') {
      if (!isLocal) {
        console.error('FATAL: DB_SSL=false is not allowed for remote database hosts');
        process.exit(1);
      }
      return false;
    }
    if (process.env.DB_SSL === 'true') return true;
    return !!host && !isLocal;
  };

  const sslOptions = (host) => {
    if (!wantsSsl(host)) return undefined;
    const ssl = { rejectUnauthorized: true };
    if (process.env.DB_SSL_CA) ssl.ca = process.env.DB_SSL_CA.replace(/\\n/g, '\n');
    return ssl;
  };

  if (connectionString) {
    const parsed = new URL(connectionString);
    const host = decodeURIComponent(parsed.hostname);
    return {
      host,
      port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
      ssl: sslOptions(host),
    };
  }

  if (process.env.MYSQLHOST) {
    const host = process.env.MYSQLHOST;
    return {
      host,
      port: Number(process.env.MYSQLPORT || 3306),
      user: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD,
      database: process.env.MYSQLDATABASE,
      ssl: sslOptions(host),
    };
  }

  const host = process.env.DB_HOST;
  return {
    host,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: sslOptions(host),
  };
}

/**
 * Abre uma conexão única (não é pool) com multipleStatements:true —
 * uso exclusivo de scripts de seed/migration rodados manualmente via CLI.
 */
async function getScriptConnection() {
  const cfg = resolveConfig();

  if (!cfg.host || !cfg.user || !cfg.database) {
    console.error(
      'FATAL: configuração de banco ausente. Copie server/.env.example para ' +
      'server/.env e preencha MYSQL_URL (ou MYSQLHOST/MYSQLUSER/MYSQLPASSWORD/' +
      'MYSQLDATABASE, ou DB_HOST/DB_USER/DB_PASSWORD/DB_NAME).'
    );
    process.exit(1);
  }

  return mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    ssl: cfg.ssl,
    multipleStatements: true,
  });
}

module.exports = { getScriptConnection };
