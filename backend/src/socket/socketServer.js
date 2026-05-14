'use strict';

/**
 * Socket.io server initialisation and singleton service.
 *
 * Exports:
 *   initSocket(httpServer) — attaches Socket.io to the HTTP server
 *   getSocketService()     — returns the singleton with emitTelemetry()
 *
 * Room strategy:
 *   - On connect:          socket joins `tenant:<tenantId>`
 *   - On subscribe:device: socket joins `device:<deviceId>` (after DB ownership check)
 *
 * Emit targets:
 *   io.to('tenant:<tenantId>').to('device:<deviceId>').emit('telemetry:new', payload)
 */

const { Server } = require('socket.io');
const { createAuthMiddleware } = require('./socketMiddleware');
const db = require('../shared/db/knex');

let socketService = null;

/**
 * Initialise Socket.io and attach it to the given HTTP server.
 *
 * @param {import('http').Server} httpServer
 */
function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  // Apply JWT auth middleware to every incoming connection
  io.use(createAuthMiddleware());

  io.on('connection', (socket) => {
    const { tenantId } = socket.data;

    // Auto-join tenant room for isolation
    socket.join(`tenant:${tenantId}`);

    // Device subscription
    socket.on('subscribe:device', async ({ deviceId } = {}) => {
      try {
        if (!deviceId) {
          socket.emit('error', { code: 'DEVICE_NOT_FOUND', message: 'deviceId is required' });
          return;
        }

        // Validate device belongs to this tenant
        const device = await db('devices')
          .where({ id: deviceId })
          .andWhere({ tenant_id: tenantId })
          .first();

        if (!device) {
          socket.emit('error', { code: 'DEVICE_NOT_FOUND', message: 'Device not found or not owned by tenant' });
          return;
        }

        socket.join(`device:${deviceId}`);
        socket.emit('subscribed', { deviceId });
      } catch (err) {
        console.error('[Socket] subscribe:device error', err && err.message ? err.message : err);
      }
    });
  });

  // Singleton service exposed to mqttClient
  socketService = {
    emitTelemetry(tenantId, deviceId, data, receivedAt, id) {
      io.to(`tenant:${tenantId}`).emit('telemetry:new', {
        id,
        deviceId,
        data,
        receivedAt,
      });
    },

    /**
     * Emit device:status to all sockets in the tenant room.
     *
     * @param {string} tenantId
     * @param {string} deviceId
     * @param {'online'|'offline'} status
     */
    emitDeviceStatus(tenantId, deviceId, status) {
      io.to(`tenant:${tenantId}`).emit('device:status', { deviceId, status });
    },
  };
}

/**
 * Returns the socket service singleton.
 * Returns null if initSocket has not been called yet.
 *
 * @returns {{ emitTelemetry: Function } | null}
 */
function getSocketService() {
  return socketService;
}

module.exports = { initSocket, getSocketService };
