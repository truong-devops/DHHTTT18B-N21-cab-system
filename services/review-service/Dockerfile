FROM node:20-alpine
WORKDIR /app

ENV NPM_CONFIG_FETCH_RETRIES=5 \
  NPM_CONFIG_FETCH_RETRY_FACTOR=2 \
  NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
  NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
  NPM_CONFIG_FETCH_TIMEOUT=300000 \
  NPM_CONFIG_AUDIT=false \
  NPM_CONFIG_FUND=false

# Install workspace deps with local libs
COPY package.json package-lock.json ./
COPY libs ./libs
COPY services/review-service/package.json services/review-service/package.json
RUN npm install --omit=dev \
  --workspaces \
  --include-workspace-root \
  --workspace @libs/http \
  --workspace @libs/validation \
  --workspace @services/review-service

COPY services/review-service ./services/review-service
WORKDIR /app/services/review-service
CMD ["node", "src/server.js"]
