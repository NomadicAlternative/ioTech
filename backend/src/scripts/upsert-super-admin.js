'use strict';

/**
 * One-shot script: upsert super admin dagc40@gmail.com / artemio1.
 *
 * Usage:
 *   cd backend && DB_USER=diegogarcia DB_NAME=iotech_dev node src/scripts/upsert-super-admin.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const bcrypt = require('bcrypt');
const knex = require('../shared/db/knex');
const { v4: uuidv4 } = require('uuid');

const EMAIL = 'dagc40@gmail.com';
const PASSWORD = 'artemio1';
const SALT_ROUNDS = 12;

async function main() {
  console.log(`[upsert-super-admin] Looking up: ${EMAIL}`);
  const existing = await knex('users').where('email', EMAIL).first();
  const hash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);

  if (existing) {
    await knex('users').where('email', EMAIL).update({
      password_hash: hash,
      role: 'super_admin',
    });
    console.log(`[upsert-super-admin] Updated user: ${EMAIL} → super_admin`);
  } else {
    // Look up or create tenant
    let tenant = await knex('tenants').where('email', EMAIL).first();
    if (!tenant) {
      const tenantId = uuidv4();
      await knex('tenants').insert({
        id: tenantId,
        name: 'ioTech Admin',
        email: EMAIL,
        status: 'active',
        trial_ends_at: null,
      });
      tenant = { id: tenantId };
      console.log(`[upsert-super-admin] Created tenant: ${tenantId}`);
    }

    await knex('users').insert({
      id: uuidv4(),
      email: EMAIL,
      password_hash: hash,
      role: 'super_admin',
      tenant_id: tenant.id,
    });
    console.log(`[upsert-super-admin] Created user: ${EMAIL} → super_admin`);
  }

  console.log('[upsert-super-admin] Done.');
  await knex.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error('[upsert-super-admin] Error:', err.message);
  knex.destroy().finally(() => process.exit(1));
});
