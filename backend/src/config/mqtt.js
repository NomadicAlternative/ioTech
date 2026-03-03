// Configuración MQTT centralizada
// Exporta una función que construye la URL y opciones a partir de variables de entorno
function createMqttConfig() {
  const url = process.env.MQTT_BROKER_URL;
  const options = {
    // mqtt.js acepta username/password si están definidos
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    // reconectar cada 1s
    reconnectPeriod: 1000
  };

  return { url, options };
}

module.exports = { createMqttConfig };
