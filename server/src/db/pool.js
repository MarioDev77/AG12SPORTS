'use strict';

const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Resolução de configuração de conexão — suporta 3 cenários, nessa ordem:
 *
 * 1) MYSQL_URL / DATABASE_URL — connection string completa
 *    (Railway expõe MYSQL_URL automaticamente quando o plugin MySQL
 *    está linkado ao serviço: mysql://user:pass@host:port/database)
 * 2) MYSQLHOST / MYSQLPORT / MYSQLUSER / MYSQLPASSWORD / MYSQLDATABASE
 *    — variáveis nativas do plugin MySQL do Railway, caso a connection
 *    string não tenha sido referenciada explicitamente.
 * 3) DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME — variáveis
 *    genéricas usadas em desenvolvimento local / docker-compose.
 *
 * Isso permite rodar exatamente o mesmo código local (docker-compose)
 * e em produção (Railway) sem alterar uma linha — só o .env muda.
 */
function resolvePoolConfig() {
  const connectionString = process.env.MYSQL_URL || process.env.DATABASE_URL;

  // SSL: obrigatório para hosts remotos (Railway exige TLS na proxy pública).
  // Em host local (127.0.0.1/localhost) ou docker-compose, mantemos SSL
  // desligado para não complicar o ambiente de desenvolvimento.
  const wantsSsl = (host) => {
    const normalizedHost = (host || '').toLowerCase();
    const isLocal = ['localhost', '127.0.0.1', 'db', 'mysql'].includes(normalizedHost);
    // Railway private-network traffic is already encrypted by its WireGuard
    // tunnel. Avoid the self-signed MySQL proxy certificate on this route.
    const isRailwayPrivate = normalizedHost.endsWith('.railway.internal');
    if (process.env.DB_SSL === 'false') {
      if (!isLocal && !isRailwayPrivate) {
        console.error('FATAL: DB_SSL=false is only allowed for local or Railway private-network database hosts');
        process.exit(1);
      }
      return false;
    }
    if (process.env.DB_SSL === 'true') return true;
    return !!host && !isLocal && !isRailwayPrivate;
  };

  const sslOptions = (host) => {
    if (!wantsSsl(host)) return undefined;
    const ssl = { rejectUnauthorized: true };
    if (process.env.DB_SSL_CA) ssl.ca = process.env.DB_SSL_CA.replace(/\\n/g, '\n');
    return ssl;
  };

  if (connectionString) {
    let parsed;
    try {
      parsed = new URL(connectionString);
    } catch {
      console.error('FATAL: MYSQL_URL/DATABASE_URL inválida');
      process.exit(1);
    }
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

  // Variáveis nativas do plugin MySQL do Railway
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

  // Fallback: variáveis genéricas (local / docker-compose)
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

const resolved = resolvePoolConfig();

const pool = mysql.createPool({
  host: resolved.host,
  port: resolved.port,
  user: resolved.user,
  password: resolved.password,
  database: resolved.database,
  ssl: resolved.ssl,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // security: do not allow multiple statements
  multipleStatements: false,
});

module.exports = { pool };

