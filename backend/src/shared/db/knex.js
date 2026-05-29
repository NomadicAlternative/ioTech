'use strict';

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const knex = require('knex');
const { createDbConfig } = require('../../config/db');

/**
 * Singleton Knex instance.
 * Import this anywhere in the app to get a shared database connection pool.
 *
 * @example
 * const db = require('../shared/db/knex');
 * const rows = await db('tenants').select('*');
 */
const db = knex(createDbConfig());

module.exports = db;
