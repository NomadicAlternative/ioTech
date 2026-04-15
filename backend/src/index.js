// Punto de entrada del backend
require('dotenv').config();

const createApp = require('./app');
const { initMqtt } = require('./mqtt/mqttClient');
const telemetryService = require('./modules/telemetry/telemetry.service');

const PORT = process.env.PORT || 3000;

const app = createApp();

// Inicializar MQTT con telemetryService inyectado para persistencia
const mqttClient = initMqtt({ telemetryService });

// Exponer estado de conexión MQTT en el health endpoint (override del genérico en app.js)
app.get('/health/mqtt', (req, res) => {
  res.json({ ok: true, mqttConnected: !!(mqttClient && mqttClient.connected) });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = app;
