FROM node:20-alpine
WORKDIR /app

# Install workspace deps with local libs
COPY package.json package-lock.json ./
COPY libs ./libs
COPY services/driver-service/package.json services/driver-service/package.json
RUN npm install --omit=dev \
  --workspaces \
  --include-workspace-root \
  --workspace @libs/validation \
  --workspace @services/driver-service

COPY services/driver-service ./services/driver-service
WORKDIR /app/services/driver-service
CMD ["node", "src/server.js"]
