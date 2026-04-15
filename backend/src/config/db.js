'use strict';

/**
 * Knex configuration factory.
 * Mirrors the pattern used by src/config/mqtt.js — reads env vars and returns
 * a plain config object so it can be consumed by knex.js (singleton) and
 * knexfile.js (CLI).
 */
function createDbConfig() {
  return {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'iotech_dev',
      user: process.env.DB_USER || 'iotech_app',
      password: process.env.DB_PASSWORD || '',
    },
    pool: {
      min: Number(process.env.DB_POOL_MIN) || 2,
      max: Number(process.env.DB_POOL_MAX) || 10,
    },
    migrations: {
      directory: './src/shared/db/migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './src/shared/db/seeds',
    },
  };
}

module.exports = { createDbConfig };
