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
  adminUsers.forEach((u) => {
    adminByTenant[u.tenant_id] = u.email;
  });

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
    credentials: { email, password }, // Only returned on creation — show to super-admin
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
  await db('users')
    .where({ id: user.id })
    .update({ password_hash: passwordHash, updated_at: new Date() });

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
    const dashboardIds = (await trx('dashboards').where({ installer_id: id }).select('id')).map(
      (d) => d.id
    );
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

  logger.warn(
    `[admin.service] Deleted tenant "${tenant.name}" (${id}) — telemetry:${summary.telemetry}, rules:${summary.rules}, firmware:${summary.firmware}, dashboards:${summary.dashboards}, devices:${summary.devices}, templates:${summary.templates}, clients:${summary.clients}, users:${summary.users}`
  );

  return { deleted: true, summary };
}

/**
 * Get system health metrics for the super-admin dashboard.
 * Queries PostgreSQL for DB size, active connections, and Node.js process metrics.
 *
 * Thresholds are configurable via env vars:
 *   DB_SIZE_WARNING_MB  (default: 300) — > yields "warning"
 *   DB_SIZE_CRITICAL_MB (default: 425) — > yields "critical"
 *   DB_SIZE_LIMIT_MB    (default: 500) — reference ceiling
 *   CONNECTION_WARNING  (default: 14)  — > yields "warning"
 *   CONNECTION_CRITICAL (default: 18)  — > yields "critical"
 *   MEMORY_WARNING_MB   (default: 350) — > yields "warning"
 *   MEMORY_CRITICAL_MB  (default: 460) — > yields "critical"
 */
async function getSystemHealth() {
  const os = require('os');
  const { getSocketService } = require('../../socket/socketServer');

  const thresholds = {
    dbSizeWarning: Number(process.env.DB_SIZE_WARNING_MB) || 10000,
    dbSizeCritical: Number(process.env.DB_SIZE_CRITICAL_MB) || 50000,
    dbSizeLimit: Number(process.env.DB_SIZE_LIMIT_MB) || 100000,
    connectionWarning: Number(process.env.CONNECTION_WARNING) || 50,
    connectionCritical: Number(process.env.CONNECTION_CRITICAL) || 90,
    memoryWarning: Number(process.env.MEMORY_WARNING_MB) || 4000,
    memoryCritical: Number(process.env.MEMORY_CRITICAL_MB) || 7200,
    cpuWarning: Number(process.env.CPU_WARNING_PCT) || 30,
    cpuCritical: Number(process.env.CPU_CRITICAL_PCT) || 70,
    mqttConnectionsWarning: Number(process.env.MQTT_CONNECTIONS_WARNING) || 100,
    mqttConnectionsCritical: Number(process.env.MQTT_CONNECTIONS_CRITICAL) || 500,
    wsClientsWarning: Number(process.env.WS_CLIENTS_WARNING) || 25,
    wsClientsCritical: Number(process.env.WS_CLIENTS_CRITICAL) || 100,
    multiRegionInstallersWarning: Number(process.env.MULTI_REGION_INSTALLERS_WARNING) || 10,
    multiRegionInstallersCritical: Number(process.env.MULTI_REGION_INSTALLERS_CRITICAL) || 50,
    multiRegionDevicesWarning: Number(process.env.MULTI_REGION_DEVICES_WARNING) || 100,
    multiRegionDevicesCritical: Number(process.env.MULTI_REGION_DEVICES_CRITICAL) || 500,
  };

  // Database metrics
  const { rows: dbSizeRows } = await db.raw('SELECT pg_database_size(current_database()) AS bytes');
  const dbSizeBytes = parseInt(dbSizeRows[0].bytes, 10);
  const dbSizeMB = Math.round(dbSizeBytes / (1024 * 1024));

  const { rows: connRows } = await db.raw(
    "SELECT count(*)::int AS active FROM pg_stat_activity WHERE state = 'active'"
  );
  const activeConnections = connRows[0].active;

  // Table-level stats
  const { rows: tableRows } = await db.raw(`
    SELECT relname AS table_name,
           pg_size_pretty(pg_total_relation_size(relid)) AS size,
           n_live_tup::int AS rows
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(relid) DESC
    LIMIT 5
  `);

  // Backend process metrics
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / (1024 * 1024));
  const uptimeSeconds = Math.floor(process.uptime());

  // Determine alert levels
  const dbPercent = Math.round((dbSizeMB / thresholds.dbSizeLimit) * 100);
  const dbLevel =
    dbSizeMB >= thresholds.dbSizeCritical
      ? 'critical'
      : dbSizeMB >= thresholds.dbSizeWarning
        ? 'warning'
        : 'healthy';

  const connPercent = Math.round(
    (activeConnections / (Number(process.env.DB_POOL_MAX) || 20)) * 100
  );
  const connLevel =
    activeConnections >= thresholds.connectionCritical
      ? 'critical'
      : activeConnections >= thresholds.connectionWarning
        ? 'warning'
        : 'healthy';

  const memPercent = Math.round((heapUsedMB / thresholds.memoryCritical) * 100);
  const memLevel =
    heapUsedMB >= thresholds.memoryCritical
      ? 'critical'
      : heapUsedMB >= thresholds.memoryWarning
        ? 'warning'
        : 'healthy';

  // ── CPU metrics ───────────────────────────────────────────────────────────
  const cpuLoad = os.loadavg()[0]; // 1-min load average
  const cpuCores = os.cpus().length;
  const cpuPercent = Math.round((cpuLoad / cpuCores) * 100);
  const cpuLevel =
    cpuPercent >= thresholds.cpuCritical
      ? 'critical'
      : cpuPercent >= thresholds.cpuWarning
        ? 'warning'
        : 'healthy';

  // ── MQTT connections ──────────────────────────────────────────────────────
  // Count recently active devices (last_seen within 2 minutes).
  // This is more reliable than ss/netstat across Docker networks.
  let mqttConnections = 0;
  try {
    const { rows: mqttRows } = await db.raw(
      "SELECT count(*)::int AS active FROM devices WHERE last_seen > NOW() - INTERVAL '2 minutes'"
    );
    mqttConnections = mqttRows[0]?.active || 0;
  } catch {
    mqttConnections = 0;
  }
  const mqttPercent = Math.round((mqttConnections / thresholds.mqttConnectionsCritical) * 100);
  const mqttLevel =
    mqttConnections >= thresholds.mqttConnectionsCritical
      ? 'critical'
      : mqttConnections >= thresholds.mqttConnectionsWarning
        ? 'warning'
        : 'healthy';

  // ── WebSocket clients ─────────────────────────────────────────────────────
  let wsClients = 0;
  try {
    const socketSvc = getSocketService();
    if (socketSvc) {
      wsClients = socketSvc.getConnectedClients();
    }
  } catch {
    // socket service not initialized
  }
  const wsPercent = Math.round((wsClients / thresholds.wsClientsCritical) * 100);
  const wsLevel =
    wsClients >= thresholds.wsClientsCritical
      ? 'critical'
      : wsClients >= thresholds.wsClientsWarning
        ? 'warning'
        : 'healthy';

  // Multi-region readiness (based on installer + device counts)
  const parseCount = (row) => (row && row.count ? parseInt(row.count, 10) : 0);
  const [tenantsRow, devicesRow] = await Promise.all([
    db('tenants').count().first(),
    db('devices').count().first(),
  ]);
  const totalInstallers = parseCount(tenantsRow);
  const totalDevices = parseCount(devicesRow);

  const multiRegionLevel =
    totalInstallers >= thresholds.multiRegionInstallersCritical ||
    totalDevices >= thresholds.multiRegionDevicesCritical
      ? 'critical'
      : totalInstallers >= thresholds.multiRegionInstallersWarning ||
          totalDevices >= thresholds.multiRegionDevicesWarning
        ? 'warning'
        : 'healthy';

  // Overall status: worst of all four
  const levels = { critical: 3, warning: 2, healthy: 1 };
  const overallLevel = [
    dbLevel,
    connLevel,
    memLevel,
    cpuLevel,
    mqttLevel,
    wsLevel,
    multiRegionLevel,
  ].reduce((worst, l) => (levels[l] > levels[worst] ? l : worst), 'healthy');

  const alerts = [];
  if (dbLevel === 'critical')
    alerts.push({
      metric: 'database',
      level: 'critical',
      message: `DB at ${dbSizeMB}MB (${dbPercent}%) — upgrade Neon now`,
    });
  else if (dbLevel === 'warning')
    alerts.push({
      metric: 'database',
      level: 'warning',
      message: `DB at ${dbSizeMB}MB (${dbPercent}%) — plan upgrade soon`,
    });
  if (connLevel === 'critical')
    alerts.push({
      metric: 'connections',
      level: 'critical',
      message: `${activeConnections} active connections — near pool limit`,
    });
  if (memLevel === 'critical')
    alerts.push({
      metric: 'backend',
      level: 'critical',
      message: `Backend memory at ${heapUsedMB}MB — possible leak`,
    });
  if (cpuLevel === 'critical')
    alerts.push({
      metric: 'cpu',
      level: 'critical',
      message: `CPU at ${cpuPercent}% — enable PM2 cluster mode or upgrade VPS`,
    });
  else if (cpuLevel === 'warning')
    alerts.push({
      metric: 'cpu',
      level: 'warning',
      message: `CPU at ${cpuPercent}% — monitor closely, consider PM2 cluster mode`,
    });
  if (mqttLevel === 'critical')
    alerts.push({
      metric: 'mqtt',
      level: 'critical',
      message: `${mqttConnections} MQTT devices connected — near capacity, upgrade to KVM 4`,
    });
  else if (mqttLevel === 'warning')
    alerts.push({
      metric: 'mqtt',
      level: 'warning',
      message: `${mqttConnections} MQTT devices — monitor RAM, plan KVM 4 upgrade`,
    });
  if (wsLevel === 'critical')
    alerts.push({
      metric: 'websocket',
      level: 'critical',
      message: `${wsClients} dashboard clients — near WebSocket limit`,
    });
  if (multiRegionLevel === 'critical')
    alerts.push({
      metric: 'multi-region',
      level: 'critical',
      message: `${totalInstallers} installers, ${totalDevices} devices — deploy multi-region now`,
    });
  else if (multiRegionLevel === 'warning')
    alerts.push({
      metric: 'multi-region',
      level: 'warning',
      message: `${totalInstallers} installers, ${totalDevices} devices — start planning multi-region`,
    });

  return {
    status: overallLevel,
    sampled_at: new Date().toISOString(),
    database: {
      size_mb: dbSizeMB,
      size_limit_mb: thresholds.dbSizeLimit,
      percent: dbPercent,
      level: dbLevel,
      active_connections: activeConnections,
      connection_limit: Number(process.env.DB_POOL_MAX) || 20,
      connection_percent: connPercent,
      connection_level: connLevel,
      largest_tables: tableRows,
    },
    backend: {
      heap_mb: heapUsedMB,
      heap_percent: memPercent,
      heap_level: memLevel,
      uptime_seconds: uptimeSeconds,
      uptime_human: formatUptime(uptimeSeconds),
      node_version: process.version,
      env: process.env.NODE_ENV || 'development',
    },
    cpu: {
      load_avg_1m: parseFloat(cpuLoad.toFixed(2)),
      cores: cpuCores,
      percent: cpuPercent,
      level: cpuLevel,
    },
    mqtt: {
      active_connections: mqttConnections,
      warning_threshold: thresholds.mqttConnectionsWarning,
      percent: mqttPercent,
      level: mqttLevel,
    },
    websocket: {
      connected_clients: wsClients,
      warning_threshold: thresholds.wsClientsWarning,
      percent: wsPercent,
      level: wsLevel,
    },
    multi_region: {
      installers: totalInstallers,
      devices: totalDevices,
      level: multiRegionLevel,
      installers_warning: thresholds.multiRegionInstallersWarning,
      installers_critical: thresholds.multiRegionInstallersCritical,
      devices_warning: thresholds.multiRegionDevicesWarning,
      devices_critical: thresholds.multiRegionDevicesCritical,
    },
    alerts,
  };
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

module.exports = {
  listTenants,
  createTenant,
  resetPassword,
  getDashboard,
  getTenantDetail,
  deleteTenant,
  getSystemHealth,
};
