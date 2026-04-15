'use strict';

const db = require('./knex');

/**
 * withTenant — Knex transaction wrapper that sets PostgreSQL's `app.tenant_id`
 * session variable before running queries, so RLS policies are enforced.
 *
 * Usage:
 *   const result = await withTenant(req.tenantId, (trx) => {
 *     return trx('devices').where({ id }).first();
 *   });
 *
 * How it works:
 *   1. Opens a Knex transaction (connection-scoped)
 *   2. Runs SET LOCAL app.tenant_id = '<tenantId>'
 *      → SET LOCAL applies only for the duration of the current transaction
 *   3. Calls the user-provided callback with the transaction object (trx)
 *   4. Commits the transaction after the callback resolves
 *   5. Rolls back on any error and re-throws
 *
 * Security note:
 *   The app DB user (iotech_app) is NOT superuser, so RLS always applies.
 *   FORCE ROW LEVEL SECURITY ensures even the table owner cannot bypass it.
 *   SET LOCAL is safe because it expires at transaction end, preventing
 *   context leakage across requests in the connection pool.
 *
 * @param {string|null} tenantId  — UUID of the current tenant. Pass null to
 *   run without setting the context (e.g. for MQTT device lookups that happen
 *   before the tenant is known). RLS will use an empty/unset value which
 *   matches no rows — effectively a safe-fail for tenant-scoped tables.
 * @param {(trx: import('knex').Knex.Transaction) => Promise<any>} callback
 * @returns {Promise<any>}
 */
async function withTenant(tenantId, callback) {
  return db.transaction(async (trx) => {
    if (tenantId) {
      // current_setting() requires the var to exist; SET LOCAL creates it
      // for the duration of this transaction only.
      await trx.raw('SET LOCAL app.tenant_id = ?', [tenantId]);
    }
    return callback(trx);
  });
}

module.exports = { withTenant };
