'use strict';

require('dotenv').config();
const { createDbConfig } = require('./src/config/db');

/**
 * knexfile.js — used by the Knex CLI (migrate, seed commands).
 * Must live at the root of the backend/ directory so the CLI can find it.
 *
 * Usage:
 *   npx knex migrate:latest --knexfile knexfile.js
 *   npx knex migrate:rollback --knexfile knexfile.js
 *   npx knex seed:run --knexfile knexfile.js
 */
module.exports = {
  development: createDbConfig(),
  test: {
    ...createDbConfig(),
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME_TEST || 'iotech_test',
      user: process.env.DB_USER || 'iotech_app',
      password: process.env.DB_PASSWORD || '',
    },
  },
  production: createDbConfig(),
};
