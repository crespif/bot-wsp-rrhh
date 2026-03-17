# ─────────────────────────────────────────────
# Stage 1: dependencias de Node
# ─────────────────────────────────────────────
FROM node:20-slim AS base

# Dependencias del sistema para Puppeteer/Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Decirle a Puppeteer que use el Chromium del sistema (no descargue uno propio)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Varibles de entorno
ENV DOCKER=true

WORKDIR /app

# Copiar manifiestos primero (mejor caché de capas)
COPY package*.json ./

# Instalar dependencias de producción solamente
RUN npm ci --omit=dev

# Copiar el código fuente
COPY . .

# Puerto del panel web
EXPOSE 3010

# Ejecutar el bot
CMD ["node", "bot-ia.js"]
