// Punto de entrada del backend
require('dotenv').config();
const express = require('express');
const { initMqtt } = require('./mqtt/mqttClient');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.send('ioTech backend — healthy');
});

// Inicializar MQTT (suscripción y logger)
const mqttClient = initMqtt();

app.get('/health', (req, res) => {
  res.json({ ok: true, mqttConnected: !!(mqttClient && mqttClient.connected) });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = app;
