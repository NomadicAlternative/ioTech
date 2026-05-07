'use strict';

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const db = require('../../shared/db/knex');
const { ConflictError } = require('../../shared/errors');
const logger = require('../../shared/logger');

/**
 * Admin service — tenant management for super-admins.
 */

async function listTenants() {
  return db('tenants').select('*').orderBy('created_at', 'desc');
}

async function createTenant({ name, email, password }) {
  // Validate password
  if (!password || password.length < 6) {
    throw new ConflictError('Password must be at least 6 characters');
  }

  // Check duplicate tenant email
  const existingTenant = await db('tenants').where({ email }).first();
  if (existingTenant) {
    throw new ConflictError('A tenant with this email already exists');
  }

  // Check duplicate user email
  const existingUser = await db('users').where({ email }).first();
  if (existingUser) {
    throw new ConflictError('A user with this email already exists');
  }

  const tenantId = uuidv4();
  const userId = uuidv4();
  const passwordHash = await bcrypt.hash(password, 10);

  // Atomic transaction: tenant + user
  await db.transaction(async (trx) => {
    await trx('tenants').insert({
      id: tenantId,
      name,
      email,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await trx('users').insert({
      id: userId,
      tenant_id: tenantId,
      email,
      password_hash: passwordHash,
      role: 'admin',
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  logger.info(`[admin.service] Created tenant "${name}" (${tenantId}) with user ${email}`);

  return {
    tenant: { id: tenantId, name, email },
    credentials: { email, password },  // Only returned on creation — show to super-admin
  };
}

module.exports = { listTenants, createTenant };
