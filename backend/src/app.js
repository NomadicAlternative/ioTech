'use strict';

const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const swaggerConfig = require('./config/swagger');
const errorHandler = require('./shared/middleware/errorHandler');

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
  app.use('/api/auth', authRoutes);
  app.use('/api/devices', devicesRoutes);
  app.use('/api/device-templates', deviceTemplatesRoutes);
  app.use('/api/installers', installersRoutes);
  app.use('/api/clients', clientsRoutes);
  app.use('/api/telemetry', telemetryRoutes);
  app.use('/api/provisioning', provisioningRoutes);
  app.use('/api/firmware', firmwareRoutes);
  app.use('/api/devices', otaRouter);
  app.use('/api/dashboards', dashboardsRoutes);
  app.use('/api/rules', rulesRoutes);
  app.use('/api/admin', adminRoutes);
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
