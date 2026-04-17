'use strict';

const { withTenant } = require('../../shared/db/tenant-knex');

/**
 * Data access layer for telemetry.
 * Uses the TimescaleDB `telemetry` hypertable.
 * All tenant-scoped operations use withTenant() for RLS enforcement.
 */

/**
 * Insert a telemetry record.
 * @param {{ deviceId: string, tenantId: string, data: object, receivedAt: string|Date }} data
 * @returns {Promise<object>}
 */
async function insert(data) {
  return withTenant(data.tenantId, (trx) =>
    trx('telemetry')
      .insert({
        device_id: data.deviceId,
        tenant_id: data.tenantId,
        data: data.data,
        received_at: data.receivedAt || new Date(),
      })
      .returning('*')
      .then(([row]) => row)
  );
}

/**
 * Query telemetry records for a specific device, with optional pagination.
 * @param {string} tenantId
 * @param {string} deviceId
 * @param {{ from?: string, to?: string, limit?: number, page?: number, sortDir?: string }} opts
 * @returns {Promise<object[]>}
 */
async function findByDevice(tenantId, deviceId, opts = {}) {
  const { from, to, limit = 100, page = 1, sortDir = 'desc' } = opts;
  const offset = (page - 1) * limit;

  return withTenant(tenantId, (trx) => {
    let q = trx('telemetry')
      .where({ tenant_id: tenantId, device_id: deviceId })
      .orderBy('received_at', sortDir)
      .limit(Math.min(limit, 1000)) // hard cap at 1000 rows per request
      .offset(offset);

    if (from) {
      q = q.where('received_at', '>=', new Date(from));
    }
    if (to) {
      q = q.where('received_at', '<=', new Date(to));
    }

    return q;
  });
}

/**
 * Count telemetry records for a specific device.
 * @param {string} tenantId
 * @param {string} deviceId
 * @param {{ from?: string, to?: string }} opts
 * @returns {Promise<number>}
 */
async function count(tenantId, deviceId, opts = {}) {
  const { from, to } = opts;

  const rows = await withTenant(tenantId, (trx) => {
    let q = trx('telemetry')
      .where({ tenant_id: tenantId, device_id: deviceId })
      .count('*');

    if (from) {
      q = q.where('received_at', '>=', new Date(from));
    }
    if (to) {
      q = q.where('received_at', '<=', new Date(to));
    }

    return q;
  });

  return parseInt(rows[0].count, 10);
}

module.exports = { insert, findByDevice, count };

