'use strict';

const knex = require('../../shared/db/knex');

/**
 * Drivers catalog service.
 * Reads from driver_catalog table — public data, no auth required.
 */
const driverCatalogService = {
  /**
   * Get the full driver catalog.
   * @param {object} [filters]
   * @param {string} [filters.category] — 'sensor', 'actuator', 'display'
   * @param {string} [filters.firmware_status] — 'available', 'untested', 'planned'
   * @returns {Promise<Array>}
   */
  async getCatalog(filters = {}) {
    let query = knex('driver_catalog')
      .whereNot('firmware_status', 'deprecated')
      .orderBy('sort_order', 'asc');

    if (filters.category) {
      query = query.where('category', filters.category);
    }
    if (filters.firmware_status) {
      query = query.where('firmware_status', filters.firmware_status);
    }

    const rows = await query;

    return rows.map((row) => ({
      ...row,
      datastreams: typeof row.datastreams === 'string'
        ? JSON.parse(row.datastreams)
        : row.datastreams || [],
      config_schema: typeof row.config_schema === 'string'
        ? JSON.parse(row.config_schema)
        : row.config_schema || null,
    }));
  },

  /**
   * Get catalog entries for a specific set of models.
   * Used by AI to fetch driver metadata for context injection.
   * @param {string[]} models
   * @returns {Promise<Array>}
   */
  async getByModels(models) {
    if (!models || models.length === 0) return [];
    const rows = await knex('driver_catalog').whereIn('model', models);
    return rows.map((row) => ({
      ...row,
      datastreams: typeof row.datastreams === 'string'
        ? JSON.parse(row.datastreams)
        : row.datastreams || [],
    }));
  },
};

module.exports = driverCatalogService;
