'use strict';

const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const swaggerConfig = require('./config/swagger');
const errorHandler = require('./shared/middleware/errorHandler');
const authGuard = require('./shared/middleware/authGuard');
const trialExpiry = require('./shared/middleware/trialExpiry');

const authRoutes = require('./modules/auth/auth.routes');
const devicesRoutes = require('./modules/devices/devices.routes');
const deviceTemplatesRoutes = require('./modules/device-templates/device-templates.routes');
const installersRoutes = require('./modules/installers/installers.routes');
const clientsRoutes = require('./modules/clients/clients.routes');
const telemetryRoutes = require('./modules/telemetry/telemetry.routes');
const provisioningRoutes = require('./modules/provisioning/provisioning.routes');
const firmwareRoutes = require('./modules/firmware/firmware.routes');
const { otaRouter } = require('./modules/firmware/firmware.routes');
const dashboardsRoutes = require('./modules/dashboards/dashboards.routes');
const rulesRoutes = require('./modules/rules/rules.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const aiRoutes = require('./modules/ai/ai.routes');
const mqttAuthGuardRouter = require('./shared/middleware/mqttAuthGuard');

/**
 * Express app factory.
 * Exported separately from index.js so tests can import the app
 * without starting the server (supertest pattern).
 *
 * @returns {import('express').Application}
 */
function createApp() {
  const app = express();

  // ── Global middleware ─────────────────────────────────────────────────────
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  }));
  app.use(cookieParser());
  app.use(express.json());

  // ── Static firmware files (public, for ESP32 OTA downloads) ──────────────
  app.use('/firmware/files', express.static(path.join(__dirname, '..', 'uploads', 'firmware')));

  // ── Health endpoint ───────────────────────────────────────────────────────
  app.get('/health', (req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // ── Module routers ────────────────────────────────────────────────────────
  // Auth routes — no authGuard, no trialExpiry
  app.use('/api/auth', authRoutes);

  // Tenant-scoped routes — require auth + trial check
  const tenantScope = [authGuard, trialExpiry];
  app.use('/api/devices', ...tenantScope, devicesRoutes);
  app.use('/api/device-templates', ...tenantScope, deviceTemplatesRoutes);
  app.use('/api/installers', ...tenantScope, installersRoutes);
  app.use('/api/clients', ...tenantScope, clientsRoutes);
  app.use('/api/telemetry', ...tenantScope, telemetryRoutes);
  app.use('/api/provisioning', ...tenantScope, provisioningRoutes);
  app.use('/api/firmware', ...tenantScope, firmwareRoutes);
  app.use('/api/devices', ...tenantScope, otaRouter);
  app.use('/api/dashboards', ...tenantScope, dashboardsRoutes);
  app.use('/api/rules', ...tenantScope, rulesRoutes);
  app.use('/api/ai', ...tenantScope, aiRoutes);

  // Admin routes — authGuard + superAdmin (trialExpiry NOT applied)
  app.use('/api/admin', authGuard, adminRoutes);

  // Internal MQTT auth — separate auth mechanism
  app.use('/internal/mqtt', mqttAuthGuardRouter);

  // ── Swagger / OpenAPI docs (no auth required) ────────────────────────────
  const swaggerSpec = swaggerJsdoc(swaggerConfig);
  // Serve raw OpenAPI JSON BEFORE swagger-ui-express intercepts the path
  app.get('/api-docs/swagger.json', (req, res) => res.json(swaggerSpec));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // ── Centralized error handler (must be last) ──────────────────────────────
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
