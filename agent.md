# ioTech – Agent Context

## 🧠 Project Overview

ioTech is a SaaS IoT platform designed for installers (electricians, integrators, technicians) who deploy smart devices for their clients.

The platform allows:
- Installers to manage multiple clients and installations
- Clients to monitor and control their systems
- Devices to communicate via MQTT
- Creation of custom dashboards using widgets

This is NOT a hobby project.  
This is a scalable IoT SaaS platform.

---

## 🎯 Core Idea

Installer → Client → Devices

Example:
- Installer installs ESP32 devices
- Devices send data via MQTT
- Client uses dashboard to control system

---

## 💼 Business Model

B2B2C SaaS:
- Installers → Clients → Devices

Revenue:
- Subscription per device
- Subscription per installer
- Future white-label

---

## 🏗 Architecture

Devices → MQTT → Backend → Database → Dashboard → Widgets

---

## ✅ What is already built

- Node.js backend (Express)
- MQTT broker working
- MQTT subscription: devices/+/telemetry
- Data ingestion working
- deviceId extraction from topic
- JSON parsing

---

## 📍 Current Phase

Phase 1 – MQTT ingestion COMPLETE

---

## ❌ Missing

- Database (PostgreSQL)
- Device registry
- Multi-tenant system
- API endpoints
- Dashboard
- Widgets
- Commands to devices

---

## 🧩 Next Steps

1. Database integration
2. Core tables (installers, customers, devices, telemetry)
3. Device registry
4. API creation
5. Data persistence

---

## 🔮 Future

- Dashboard builder
- Widget library
- Automation rules

---

## 🔁 MQTT Protocol

devices/{deviceId}/telemetry
devices/{deviceId}/command (future)

---

## ⚙️ Rules

- Use .env
- No secrets in repo
- Modular code
- Validate inputs
- Think multi-tenant

---

## 🚀 Vision

Professional IoT SaaS platform for installers with scalable architecture and customizable dashboards.

---

## 📌 Current Goal

DATABASE + DEVICE REGISTRY
