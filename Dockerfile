FROM node:20-slim

WORKDIR /app

# Shared libraries required by Chrome for Testing on Debian slim, plus fonts.
# We intentionally do NOT install Debian's `chromium` package — its version
# drifts with every rebuild (it silently jumped to 150 while puppeteer 24.x
# supports ~133, breaking all rendering). Instead puppeteer installs its own
# pinned, compatibility-tested Chrome below.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    fonts-noto-color-emoji \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxkbcommon0 \
    libxrandr2 \
    libxrender1 \
    libxshmfence1 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Keep the browser inside the app dir so it deterministically survives into
# the runtime image and puppeteer.executablePath() resolves it.
ENV PUPPETEER_CACHE_DIR=/app/.puppeteer

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && npx puppeteer browsers install chrome

COPY src/ ./src/
RUN mkdir -p /app/uploads

EXPOSE 3000

CMD ["node", "src/server.js"]
