'use strict';

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const db = require('../../shared/db/knex');
const { ConflictError, NotFoundError } = require('../../shared/errors');
const logger = require('../../shared/logger');

/**
 * Admin service — tenant management for super-admins.
 */

async function listTenants() {
  const tenants = await db('tenants').select('*').orderBy('created_at', 'desc');

  if (tenants.length === 0) return [];

  const tenantIds = tenants.map((t) => t.id);

  // Fetch admin user per tenant (batch)
  const adminUsers = await db('users')
    .select('tenant_id', 'email')
    .whereIn('tenant_id', tenantIds)
    .where('role', 'admin');

  // Fetch clients per tenant (batch)
  const clients = await db('clients')
    .select('id', 'tenant_id', 'name', 'email')
    .whereIn('tenant_id', tenantIds)
    .orderBy('name');

  // Build lookup maps
  const adminByTenant = {};
  adminUsers.forEach((u) => { adminByTenant[u.tenant_id] = u.email; });

  const clientsByTenant = {};
  clients.forEach((c) => {
    if (!clientsByTenant[c.tenant_id]) clientsByTenant[c.tenant_id] = [];
    clientsByTenant[c.tenant_id].push({ id: c.id, name: c.name, email: c.email });
  });

  return tenants.map((t) => ({
    ...t,
    adminEmail: adminByTenant[t.id] || null,
    clients: clientsByTenant[t.id] || [],
  }));
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

  // Atomic transaction: tenant (with auto-trial grant) + user
  await db.transaction(async (trx) => {
    await trx('tenants').insert({
      id: tenantId,
      name,
      email,
      trial_ends_at: trx.raw("NOW() + INTERVAL '3 days'"),
      status: 'trial',
      plan: 'base',
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

async function resetPassword(tenantId, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    throw new ConflictError('Password must be at least 6 characters');
  }

  const tenant = await db('tenants').where({ id: tenantId }).first();
  if (!tenant) {
    throw new ConflictError('Tenant not found');
  }

  const user = await db('users').where({ tenant_id: tenantId, role: 'admin' }).first();
  if (!user) {
    throw new ConflictError('No admin user found for this tenant');
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db('users').where({ id: user.id }).update({ password_hash: passwordHash, updated_at: new Date() });

  logger.info(`[admin.service] Reset password for tenant "${tenant.name}" user ${user.email}`);

  return { email: user.email, password: newPassword };
}

/**
 * Get cross-tenant KPI counts for the admin dashboard (ADMIN-001).
 *
 * Queries db directly WITHOUT withTenant() to bypass RLS (ADMIN-003).
 *
 * @returns {Promise<{ totalUsers: number, totalDevices: number, activeDevices: number, totalTenants: number }>}
 */
async function getDashboard() {
  const parseCount = (row) => (row && row.count ? parseInt(row.count, 10) : 0);

  const [usersRow, devicesRow, activeDevicesRow, tenantsRow] = await Promise.all([
    db('users').count().first(),
    db('devices').count().first(),
    db('devices').where({ status: 'active' }).count().first(),
    db('tenants').count().first(),
  ]);

  return {
    totalUsers: parseCount(usersRow),
    totalDevices: parseCount(devicesRow),
    activeDevices: parseCount(activeDevicesRow),
    totalTenants: parseCount(tenantsRow),
  };
}

/**
 * Get tenant detail with device and user counts (ADMIN-002).
 *
 * @param {string} id - Tenant UUID
 * @returns {Promise<object>} Tenant with deviceCount, userCount
 * @throws {NotFoundError} When tenant does not exist
 */
async function getTenantDetail(id) {
  const tenant = await db('tenants').where({ id }).first();

  if (!tenant) {
    throw new NotFoundError('Tenant not found');
  }

  const parseCount = (row) => (row && row.count ? parseInt(row.count, 10) : 0);

  const [deviceCountRow, userCountRow] = await Promise.all([
    db('devices').where({ tenant_id: id }).count().first(),
    db('users').where({ tenant_id: id }).count().first(),
  ]);

  return {
    ...tenant,
    deviceCount: parseCount(deviceCountRow),
    userCount: parseCount(userCountRow),
  };
}

/**
 * Delete a tenant and ALL associated data.
 * This is IRREVERSIBLE — cascades to users, devices, clients,
 * dashboards, templates, firmware, rules, and telemetry.
 *
 * @param {string} id - Tenant UUID
 * @returns {Promise<{ deleted: boolean, summary: object }>}
 * @throws {NotFoundError} When tenant does not exist
 */
async function deleteTenant(id) {
  const tenant = await db('tenants').where({ id }).first();
  if (!tenant) {
    throw new NotFoundError('Tenant not found');
  }

  const summary = {};

  await db.transaction(async (trx) => {
    // 1. Telemetry (potentially massive — delete first)
    summary.telemetry = await trx('telemetry').where({ tenant_id: id }).del();

    // 2. Rules
    summary.rules = await trx('rules').where({ tenant_id: id }).del();

    // 3. Firmware versions
    summary.firmware = await trx('firmware_versions').where({ tenant_id: id }).del();

    // 4. Dashboards + dashboard_clients
    const dashboardIds = (await trx('dashboards').where({ installer_id: id }).select('id')).map((d) => d.id);
    if (dashboardIds.length > 0) {
      await trx('dashboard_clients').whereIn('dashboard_id', dashboardIds).del();
    }
    summary.dashboards = await trx('dashboards').where({ installer_id: id }).del();

    // 5. Devices
    summary.devices = await trx('devices').where({ tenant_id: id }).del();

    // 6. Device templates
    summary.templates = await trx('device_templates').where({ tenant_id: id }).del();

    // 7. Clients
    summary.clients = await trx('clients').where({ tenant_id: id }).del();

    // 8. Refresh tokens (via users)
    const userIds = (await trx('users').where({ tenant_id: id }).select('id')).map((u) => u.id);
    if (userIds.length > 0) {
      await trx('refresh_tokens').whereIn('user_id', userIds).del();
    }

    // 9. Users
    summary.users = await trx('users').where({ tenant_id: id }).del();

    // 10. Tenant itself — LAST
    await trx('tenants').where({ id }).del();
  });

  logger.warn(`[admin.service] Deleted tenant "${tenant.name}" (${id}) — telemetry:${summary.telemetry}, rules:${summary.rules}, firmware:${summary.firmware}, dashboards:${summary.dashboards}, devices:${summary.devices}, templates:${summary.templates}, clients:${summary.clients}, users:${summary.users}`);

  return { deleted: true, summary };
}

module.exports = { listTenants, createTenant, resetPassword, getDashboard, getTenantDetail, deleteTenant };
