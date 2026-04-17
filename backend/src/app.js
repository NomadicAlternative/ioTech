'use strict';

const express = require('express');
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
  app.use(express.json());

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
