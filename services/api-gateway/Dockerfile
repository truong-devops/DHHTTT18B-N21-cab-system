FROM node:20-alpine

WORKDIR /app

ENV NPM_CONFIG_FETCH_RETRIES=5 \
  NPM_CONFIG_FETCH_RETRY_FACTOR=2 \
  NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
  NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
  NPM_CONFIG_FETCH_TIMEOUT=300000 \
  NPM_CONFIG_AUDIT=false \
  NPM_CONFIG_FUND=false

COPY services/api-gateway/package*.json ./
RUN npm install

COPY libs ./libs
COPY services/api-gateway/src ./src

EXPOSE 8080
CMD ["npm", "run", "start"]
