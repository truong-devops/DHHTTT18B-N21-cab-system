FROM node:20-alpine
WORKDIR /app

# Install dependencies from monorepo root to resolve workspace libs
COPY package.json package-lock.json ./
COPY services/api-gateway/package.json services/api-gateway/package.json
COPY libs/http/package.json libs/http/package.json
COPY libs/validation/package.json libs/validation/package.json
RUN npm install --omit=dev

COPY services/api-gateway ./services/api-gateway
COPY libs ./libs

WORKDIR /app/services/api-gateway
CMD ["node", "src/server.js"]
