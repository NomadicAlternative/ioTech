// Punto de entrada del backend
// Env vars from platform (Railway). Uncomment for local dev:
// if (process.env.NODE_ENV !== 'production') require('dotenv').config();

const http = require('http');
const createApp = require('./app');
const { initMqtt } = require('./mqtt/mqttClient');
const { initSocket, getSocketService } = require('./socket/socketServer');
const telemetryService = require('./modules/telemetry/telemetry.service');

const PORT = process.env.PORT || 3000;

const app = createApp();

// Create HTTP server explicitly so Socket.io can attach to it
const httpServer = http.createServer(app);

// Initialise Socket.io WebSocket server (only in production — not during tests)
// app.js is used for supertest; index.js is the production entry point
if (process.env.NODE_ENV !== 'test') {
  initSocket(httpServer);
}

// Inicializar MQTT con telemetryService y socketService inyectados
const socketService = getSocketService();
const mqttClient = initMqtt({ telemetryService, socketService });

// Exponer estado de conexión MQTT en el health endpoint (override del genérico en app.js)
app.get('/health/mqtt', (req, res) => {
  res.json({ ok: true, mqttConnected: !!(mqttClient && mqttClient.connected) });
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = app;
