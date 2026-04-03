FROM node:20-alpine
WORKDIR /app

ENV NPM_CONFIG_FETCH_RETRIES=5 \
  NPM_CONFIG_FETCH_RETRY_FACTOR=2 \
  NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
  NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
  NPM_CONFIG_FETCH_TIMEOUT=300000 \
  NPM_CONFIG_AUDIT=false \
  NPM_CONFIG_FUND=false

COPY package.json package-lock.json ./
COPY libs ./libs
COPY services/notification-service/package.json services/notification-service/package.json

RUN npm install --omit=dev \
  --workspaces \
  --include-workspace-root \
  --workspace @libs/observability \
  --workspace @services/notification-service

COPY services/notification-service ./services/notification-service

WORKDIR /app/services/notification-service
CMD ["node", "src/server.js"]
