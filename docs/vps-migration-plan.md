# Plan de Migración a Hostinger VPS KVM 2

> **Principio**: migrar por capas, una por semana. Cada paso es independiente, testeable y reversible.
> **Objetivo**: eliminar la fricción multi-servicio sin romper lo que ya funciona.

---

## Semana 0 — Setup inicial del VPS (~2 horas)

### 0.1 — Acceso y seguridad
```bash
# Desde tu máquina
ssh root@<IP_DEL_VPS>

# Crear usuario no-root
adduser iotech
usermod -aG sudo iotech

# SSH: deshabilitar root login y password auth
# /etc/ssh/sshd_config:
#   PermitRootLogin no
#   PasswordAuthentication no
#   PubkeyAuthentication yes

# Firewall — solo puertos necesarios
ufw allow 22     # SSH
ufw allow 80     # HTTP (Nginx)
ufw allow 443    # HTTPS (Nginx)
ufw allow 8883   # MQTTS (ESP32)
ufw allow 3000   # Backend (solo localhost, Nginx hace reverse proxy)
ufw enable
```

### 0.2 — Docker + Docker Compose
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker iotech
# Cerrar sesión y volver a entrar como iotech
```

### 0.3 — Estructura de directorios
```
/home/iotech/
├── mqtt/          # Mosquitto config + data
├── backend/       # Repo iotech/backend
├── frontend/      # Build del frontend (dist/)
├── firmware/      # firmware.bin compilado
├── docker-compose.yml
└── nginx/         # Config de Nginx
```

---

## Semana 1 — MQTT: Mosquitto en el VPS (~3 horas)

**Este paso elimina HiveMQ Cloud. Backend y frontend siguen en Render/Vercel.**

### 1.1 — Mosquitto con TLS y WebSockets
```yaml
# docker-compose.yml (solo MQTT por ahora)
services:
  mosquitto:
    image: eclipse-mosquitto:2
    ports:
      - "8883:8883"   # MQTTS (ESP32)
      - "9001:9001"   # WebSocket (backend Socket.io no necesita,
                      #            pero útil para debug)
    volumes:
      - ./mqtt/config:/mosquitto/config
      - ./mqtt/data:/mosquitto/data
      - ./mqtt/log:/mosquitto/log
```

### 1.2 — Configuración Mosquitto
```conf
# mqtt/config/mosquitto.conf
listener 8883
protocol mqtt
cafile /mosquitto/config/ca.crt
certfile /mosquitto/config/server.crt
keyfile /mosquitto/config/server.key
tls_version tlsv1.2
require_certificate false  # ESP32 no tiene certificado de cliente

# Auth por username/password
password_file /mosquitto/config/passwd
allow_anonymous false

# Persistencia
persistence true
persistence_location /mosquitto/data/
```

### 1.3 — SSL con Let's Encrypt
```bash
# Instalar certbot
sudo apt install certbot

# Obtener certificado para mqtt.tudominio.com
sudo certbot certonly --standalone -d mqtt.tudominio.com

# Copiar a la carpeta de Mosquitto
sudo cp /etc/letsencrypt/live/mqtt.tudominio.com/fullchain.pem mqtt/config/server.crt
sudo cp /etc/letsencrypt/live/mqtt.tudominio.com/privkey.pem mqtt/config/server.key

# Auto-renewal: crontab cada mes
# 0 0 1 * * certbot renew --quiet && cp ... && docker restart mosquitto
```

### 1.4 — Crear credenciales de dispositivos
```bash
# Generar users para ESP32
docker exec -it mosquitto mosquitto_passwd -c /mosquitto/config/passwd iotech-esp32
# Password: Artemio1 (mismo que usaban con HiveMQ)
```

### 1.5 — Apuntar el ESP32 al nuevo broker
Cambiar `MQTT_BROKER_URL` en las env vars del backend de:
```
mqtts://abc123.s1.eu.hivemq.cloud:8883
```
a:
```
mqtts://mqtt.tudominio.com:8883
```

### ✅ Test: ¿Funciona?
- El ESP32 publica telemetría → llega a Mosquitto → backend Render la recibe
- `docker logs mosquitto` muestra conexiones y publicaciones

---

## Semana 2 — Backend: De Render al VPS (~4 horas)

**El backend se mueve al VPS. Frontend sigue en Vercel.**

### 2.1 — Dockerfile del backend
```dockerfile
# backend/Dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]
```

### 2.2 — docker-compose.yml actualizado
```yaml
services:
  mosquitto:
    # ... (semana 1)

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgresql://user:pass@postgres:5432/iotech
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
      - MQTT_BROKER_URL=mqtts://mosquitto:8883
      - MQTT_DEVICE_USERNAME=iotech-esp32
      - MQTT_DEVICE_PASSWORD=Artemio1
      - VITE_API_URL=https://api.tudominio.com
    depends_on:
      - postgres
      - mosquitto
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=iotech
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=iotech
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  pgdata:
```

### 2.3 — Migrar la base de datos
```bash
# 1. Hacer dump de la DB en Render
pg_dump $RENDER_DATABASE_URL > iotech_dump.sql

# 2. Restaurar en el VPS
docker exec -i postgres psql -U iotech iotech < iotech_dump.sql

# 3. Correr migraciones pendientes
docker exec backend npx knex migrate:latest
```

### 2.4 — DNS: configurar api.tudominio.com
Apuntar `api.tudominio.com` a la IP del VPS.

### ✅ Test: ¿Funciona?
- `curl https://api.tudominio.com/health` responde OK
- Login funciona desde Vercel (CORS configurado)
- Dashboard carga datos desde el nuevo backend

---

## Semana 3 — Frontend: De Vercel al VPS (~2 horas)

### 3.1 — Nginx para servir el frontend
```nginx
# nginx/iotech.conf
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tudominio.com www.tudominio.com;

    ssl_certificate     /etc/letsencrypt/live/tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tudominio.com/privkey.pem;

    # Frontend estático
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API reverse proxy al backend
    location /api/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Socket.io reverse proxy
    location /socket.io/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }
}
```

### 3.2 — docker-compose.yml final
```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./frontend/dist:/usr/share/nginx/html:ro
      - ./nginx/iotech.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - backend
    restart: unless-stopped

  backend:
    # ... (sin cambios)

  postgres:
    # ... (sin cambios)

  mosquitto:
    # ... (sin cambios)
```

### 3.3 — Actualizar VITE_API_URL
Cambiar de `https://api.render.com/...` a `https://tudominio.com`.

### ✅ Test: ¿Funciona?
- `https://tudominio.com` carga el frontend
- Login, dashboard, dispositivos — todo igual que antes
- Socket.io conecta a `https://tudominio.com/socket.io/`

---

## Semana 4 — Pulido final (~3 horas)

### 4.1 — CI/CD con GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy to VPS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build frontend
        run: |
          cd frontend
          npm ci
          VITE_API_URL=https://tudominio.com npm run build

      - name: Deploy via rsync
        uses: easingthemes/ssh-deploy@v5
        with:
          SSH_PRIVATE_KEY: ${{ secrets.VPS_SSH_KEY }}
          REMOTE_HOST: ${{ secrets.VPS_HOST }}
          REMOTE_USER: iotech
          SOURCE: "backend/ frontend/dist/ firmware/"
          TARGET: "/home/iotech/"

      - name: Restart services
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: iotech
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /home/iotech
            docker compose up -d --build backend
            docker compose restart nginx
```

### 4.2 — Backups automáticos
```bash
# crontab en el VPS
# Backup diario de PostgreSQL
0 3 * * * docker exec postgres pg_dump -U iotech iotech > /home/iotech/backups/db_$(date +\%Y\%m\%d).sql

# Backup semanal de configuraciones
0 4 * * 0 tar -czf /home/iotech/backups/config_$(date +\%Y\%m\%d).tar.gz \
  /home/iotech/mqtt/config /home/iotech/nginx /home/iotech/.env
```

### 4.3 — Monitoreo simple
```bash
# health check crontab cada 5 minutos — te avisa si algo se cae
*/5 * * * * curl -f https://tudominio.com/health || \
  echo "ALERT: site down at $(date)" | mail -s "ioTech DOWN" tu@email.com
```

---

## 📊 Comparativa final

| | Stack actual | VPS Hostinger |
|---|---|---|
| **Costo mensual** | $0-304 (según escala) | **~$15 fijo** |
| **Servicios** | 3 (Vercel, Render, HiveMQ) | **1 (VPS)** |
| **Deploy** | Automático (push) | Automático (GitHub Actions) |
| **MQTT límite** | 5 gratis → $49+ | **Ilimitado** |
| **Debugging cross-service** | Frecuente (CORS, TLS, SNI) | **Casi cero** |
| **SSL** | Automático | Let's Encrypt (1 vez) |
| **Tiempo total de migración** | — | **~12 horas en 4 semanas** |

---

## 🎯 Recomendación final

**Con 10 dispositivos**: el VPS ya es más barato ($15 vs ~$94) y elimina toda la fricción que ya sufriste (TLS/SNI de HiveMQ, CORS Render↔Vercel, WebSocket sticky sessions).

**Si un día necesitás escalar a 500+ dispositivos**: agregás otro VPS solo para MQTT con EMQX (soporta millones de conexiones), y el resto sigue igual. Seguís controlando todo.
