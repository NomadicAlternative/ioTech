# ioTech — Manual del Instalador

> **Para quién**: Instaladores eléctricos, integradores y técnicos que despliegan dispositivos ESP32 para sus clientes.
> **Resultado**: Al final de este manual, tendrás un ESP32 funcionando, conectado a WiFi y MQTT, controlable desde un dashboard web con widgets interactivos.

---

## 🧠 ¿Qué es ioTech?

ioTech es una plataforma IoT **B2B2C**. El instalador crea su cuenta, configura dispositivos, los instala en casa del cliente, y el cliente puede verlos desde un dashboard.

```
Instalador → Tenant → Dispositivos ESP32 → MQTT → Backend → Dashboard → Cliente
```

**Stack tecnológico**: Node.js + Express + PostgreSQL + MQTT + React + Vite + Tailwind + PlatformIO + ESP-IDF

---

## ⚡ Quick Path — Flujo desde cero

| Paso | Acción | Tiempo |
|------|--------|--------|
| 1 | Registrarse como installer | 30s |
| 2 | Crear Template (datastreams) | 2min |
| 3 | Crear Device | 30s |
| 4 | Conectar ESP32 vía USB | — |
| 5 | Flash & Provision (un click) | ~60s |
| 6 | Crear Dashboard con widgets | 3min |
| ✅ | **Dispositivo controlable desde la web** | |

---

## 📦 1. Registro como Installer

### ¿Por qué?

El installer necesita su propio **tenant** (espacio aislado con sus dispositivos y clientes). El registro crea tenant + usuario en un solo paso.

### Cómo

Desde la consola del navegador (F12 → Console), **estando en `http://localhost:5173/login`**:

```js
fetch('http://localhost:3000/api/auth/installer-register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Nombre de tu empresa',
    email: 'tu@email.com',
    password: 'contraseña123'
  })
}).then(r => r.json()).then(console.log)
```

Esto devuelve `{ accessToken, user, tenant }`. Ahora podés loguearte con ese email/password en la pantalla de login.

> **¿Qué pasó?** El backend creó una fila en `tenants` y otra en `users`, en una sola transacción atómica. Si algo falla, se hace rollback.

---

## 📋 2. Template — La "receta" del dispositivo

### ¿Por qué?

Un **Template** define qué datos (datastreams) puede enviar o recibir un dispositivo. Es como un plano: lo creás una vez y lo reutilizás en todos los dispositivos del mismo tipo.

### Cómo

1. Andá a **📋 Templates** → **New template**
2. Completá:
   - **Name**: ej. `Relay Controller 7CH`
   - **Description**: ej. `Controlador de 7 relés para tablero eléctrico`
3. Click **Create**
4. En **Datastreams**, agregá cada variable que mide o controla el dispositivo:

| Key | Name | Type | Direction |
|-----|------|------|-----------|
| `relay_1` | Relé 1 | Boolean | Output |
| `relay_2` | Relé 2 | Boolean | Output |
| `relay_3` | Relé 3 | Boolean | Output |
| ... | ... | ... | ... |

- **Key**: identificador único (el firmware usa este nombre para publicar/recibir datos)
- **Type**: `number`, `string`, `boolean`, `json`
- **Direction**: `input` (el dispositivo envía), `output` (recibe comandos), `config`

5. **Save Changes**

> **Patrón**: Siempre usá `snake_case` para las keys porque coinciden con los tópicos MQTT y el firmware en C.

---

## 💻 3. Device — El dispositivo en la plataforma

### ¿Por qué?

El **Device** es la representación digital del ESP32 físico. Al crearlo, el backend **genera automáticamente** un `claim_token` y un `device_token`. El `device_token` es secreto — identifica al dispositivo ante el MQTT broker. El `claim_token` es para vincular el hardware físico.

### Cómo

1. Andá a **💻 Devices** → **New device**
2. Completá:
   - **Name**: ej. `Tablero Principal`
   - **Template**: seleccioná el template que creaste
3. Click **Create**

El device aparece como **unclaimed**. Cuando el ESP32 se conecte, pasará a **claimed** → **active**.

---

## ⚡ 4. Flash & Provision — Un click

### ¿Por qué?

El ESP32 viene de fábrica sin firmware. Necesitamos:
1. **Flashear** = cargar el programa en la memoria del ESP32
2. **Provisionar** = enviarle credenciales WiFi y MQTT vía USB Serial

El botón **"Flash & Provision"** hace las dos cosas con un wizard guiado.

### Cómo

1. Conectá el ESP32 a la computadora vía USB (cable con datos)
2. Andá al device → click en **"Flash & Provision"**
3. El wizard muestra 3 fases:

| Fase | Qué pasa | Qué ves |
|------|----------|---------|
| **Build** | PlatformIO compila el firmware | Logs en vivo en terminal verde |
| **Flash** | Se escribe el firmware en el ESP32 | ~30-40 segundos de progreso |
| **Reset** | Se te pide presionar EN/RESET | ⚠️ Alerta naranja con instrucciones |

4. **Apretá EN/RESET** en el ESP32 cuando aparezca el aviso naranja
5. Click en **Continue — Configure WiFi**
6. Ingresá SSID y password del WiFi del cliente
7. Seleccioná el puerto serial (`/dev/cu.usbserial-*`) y click en **Connect**

El ProvisioningModal envía este JSON por UART al ESP32:

```json
{
  "wifi_ssid": "MiWiFi",
  "wifi_password": "clave123",
  "backend_url": "http://192.168.x.x:3000",
  "mqtt_url": "mqtt://192.168.x.x:1883",
  "device_token": "uuid-generado-por-el-backend",
  "tenant_id": "uuid-del-tenant",
  "device_id": "uuid-del-device"
}
```

El ESP32 lo recibe, se conecta a WiFi, se autentica con el MQTT broker usando `device_token`, y aparece **online** en el dashboard.

> **Alternativa por terminal**:
> ```bash
> cd ioTech && ./scripts/flash-device.sh <DEVICE_ID>
> ```
> Esto hace build + flash. Las credenciales WiFi las ingresás después desde la UI.

---

## 📊 5. Dashboard — El panel de control

### ¿Por qué?

El dashboard es lo que ve el cliente final. Widgets como toggles, gauges, gráficos y botones muestran datos en tiempo real vía WebSocket.

### Cómo

1. Andá a **📊 Dashboards** → **New dashboard**
2. Completá Name y Description → Create
3. En el editor, seleccioná widgets de la paleta lateral:

| Widget | Datastream | Uso típico |
|--------|-----------|------------|
| Toggle Switch | `relay_1` (Boolean output) | Encender/apagar relay |
| Button | `relay_2` | Acción momentánea |
| Gauge | `temperature` (Number input) | Mostrar temperatura |
| Status Indicator | `status` | Online/offline |
| Line Chart | `consumption` (Number) | Histórico de consumo |

4. Configurá cada widget: device → datastream → ajustes específicos
5. Arrastrá y redimensioná en el grid
6. Se guarda automáticamente (debounce 1.5s)

---

## 🔌 GPIO Map — 7 Relays (Referencia)

Cuando usás el módulo de 7 relays con ESP32:

| Relay | GPIO | Activo |
|-------|------|--------|
| Relay 1 | 23 | LOW |
| Relay 2 | 22 | LOW |
| Relay 3 | 21 | LOW |
| Relay 4 | 19 | LOW |
| Relay 5 | 18 | LOW |
| Relay 6 | 5 | LOW |
| Relay 7 | 17 | LOW |

> **Nota**: Los relays son activos en LOW (0 = encendido, 1 = apagado). El firmware maneja esta inversión internamente — vos mandás `"on"`/`"off"` y el firmware traduce.

---

## 📡 MQTT — Cómo se comunican los dispositivos

```
Dispositivo → publica → devices/{deviceId}/telemetry → Backend
Backend   → publica → devices/{deviceId}/command   → Dispositivo
```

- **Telemetry**: el ESP32 envía datos cada N segundos. Ej: `{ "temperature": 23.5, "relay_1": true }`
- **Command**: el dashboard envía comandos vía MQTT. Ej: `{ "type": "relay", "relay": 1, "state": "on" }`

---

## 🧪 Troubleshooting

| Problema | Causa probable | Solución |
|----------|---------------|----------|
| Device no aparece online | ESP32 no conectó a WiFi | Verificá SSID/password en el provisioning |
| Flash falla | Puerto serial ocupado | Cerrá miniterm, Arduino IDE, etc. |
| Web Serial no funciona | Navegador sin soporte | Usá Chrome o Edge (Safari/Firefox no soportan) |
| "Cannot POST" | Token expirado | Cerrá sesión y volvé a loguearte |
| Template no guarda (error 500) | Bug de JSON | Usá el endpoint por API con curl |

---

## 🔐 Seguridad

- **Multi-tenant**: cada installer ve SOLO sus dispositivos (Row-Level Security en PostgreSQL)
- **JWT**: access token (15 min) + refresh token (7 días, httpOnly cookie)
- **device_token**: UUID generado por el backend, identifica al ESP32 ante MQTT
- **claim_token**: UUID público para vincular hardware físico

---

## ✅ Checklist de instalación

- [ ] Registrarme como installer
- [ ] Crear template con datastreams correctos
- [ ] Crear device (anotar claim_token)
- [ ] Conectar ESP32 vía USB
- [ ] Flash & Provision
- [ ] Verificar que el device aparece **online**
- [ ] Crear dashboard con widgets
- [ ] Probar control de relays desde la UI
- [ ] Compartir dashboard con el cliente (`Share` → seleccionar cliente)

---

## ⏭️ Próximos pasos

- **Compartir dashboard**: andá al dashboard → Share → seleccioná un cliente
- **Reglas de automatización**: Rules → crear reglas como "si temperatura > 30°C → encender relay 2"
- **OTA updates**: próximamente — actualizar firmware del ESP32 desde la web
