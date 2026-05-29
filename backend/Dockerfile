FROM node:22-alpine

WORKDIR /app

# Install backend dependencies
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# Copy source code
COPY backend/src ./src

EXPOSE 3000
CMD ["node", "src/index.js"]
