FROM node:20-alpine

WORKDIR /app

ENV NPM_CONFIG_FETCH_RETRIES=5 \
  NPM_CONFIG_FETCH_RETRY_FACTOR=2 \
  NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
  NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
  NPM_CONFIG_FETCH_TIMEOUT=300000 \
  NPM_CONFIG_AUDIT=false \
  NPM_CONFIG_FUND=false

# copy package
COPY services/auth-service/package*.json ./
RUN npm install

# copy source
COPY services/auth-service ./

EXPOSE 4001
CMD ["npm", "run", "start"]
