<p align="center">
  <img src="https://img.shields.io/badge/react-19-61DAFB?logo=react" alt="React 19"/>
  <img src="https://img.shields.io/badge/typescript-6-3178C6?logo=typescript" alt="TypeScript 6"/>
  <img src="https://img.shields.io/badge/node.js-22-339933?logo=nodedotjs" alt="Node.js"/>
  <img src="https://img.shields.io/badge/postgresql-16-4169E1?logo=postgresql" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/mqtt-5-660066?logo=mqtt" alt="MQTT"/>
  <img src="https://img.shields.io/badge/esp--idf-5-E7352C?logo=espressif" alt="ESP-IDF"/>
  <img src="https://img.shields.io/badge/tailwind-4-06B6D4?logo=tailwindcss" alt="Tailwind CSS 4"/>
</p>

# ioTech — IoT SaaS Platform

**iotech** es una plataforma IoT SaaS multi-tenencia completa que conecta dispositivos ESP32 con una dashboard web en tiempo real. Gestiona desde el firmware del dispositivo hasta la visualización de telemetría, con un generador de configuración por IA, sistema de reglas automatizadas y dashboards personalizables.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Zustand 5 |
| **Backend** | Node.js, Express 5, Knex, PostgreSQL + TimescaleDB |
| **Tiempo Real** | Socket.IO, MQTT 5 |
| **Firmware** | ESP-IDF 5 (C, FreeRTOS), PlatformIO |
| **IA** | DeepSeek API + rule-based fallback |
| **Testing** | Vitest (frontend), Jest + Supertest (backend), Unity (firmware) |

---

## Features

- **Multi-tenencia** con Row-Level Security en PostgreSQL
- **Autenticación JWT** con access + refresh tokens, roles (installer/admin/super_admin)
- **Dashboard en tiempo real** con WebSockets y 9 tipos de widgets (gráficos, gauges, mapas, toggle switches, etc.)
- **Generador de configuración por IA** — describe tu dispositivo en lenguaje natural y genera el template, reglas y código
- **Sistema de reglas automatizadas** — umbrales, status, cooldown, acciones (relé, comandos, carga)
- **Gestión de dispositivos** — CRUD, claim flow, provisioning, OTA updates
- **Firmware ESP32** — 34 drivers de sensores/actuadores, WiFi manager, captive portal, provisioning por serial
- **Internacionalización** — 6 idiomas (es, en, de, fr, it, pt)
- **API REST documentada** con Swagger/OpenAPI
- **Cobertura de tests** >80% en backend, tests unitarios e integración

---

## Arquitectura

```
ioTech/
├── frontend/          # React 19 SPA
│   ├── src/
│   │   ├── features/  # 13 módulos: auth, devices, dashboard, rules, ai, etc.
│   │   ├── components/# UI components (shadcn/ui)
│   │   ├── stores/    # Zustand stores
│   │   └── providers/ # Socket.IO, theme
│   └── ...
├── backend/           # Node.js + Express API
│   ├── src/
│   │   ├── modules/   # 12 módulos: auth, devices, telemetry, firmware, ai, etc.
│   │   ├── mqtt/      # MQTT client + handlers
│   │   ├── socket/    # WebSocket server
│   │   └── shared/    # DB, middleware, errores, email
│   └── tests/
├── firmware/          # ESP-IDF 5 + PlatformIO
│   ├── components/    # 46 componentes: state machine, drivers, OTA, etc.
│   └── test/          # Unity host tests
└── docs/              # SDD, documentación técnica
```

---

## Primeros pasos

```bash
# Backend
cd backend
cp .env.example .env  # Configurar DB, MQTT, JWT
npm install
npx knex migrate:latest
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

---

## Testing

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test

# Firmware (host tests)
cd firmware && platformio test -e native
```

---

## Licencia

Private — todos los derechos reservados.
