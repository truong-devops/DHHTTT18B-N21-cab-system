FROM node:20-alpine
WORKDIR /app

# Install workspace deps with local libs
COPY package.json package-lock.json ./
COPY libs ./libs
COPY contracts ./contracts
COPY services/ride-service/package.json services/ride-service/package.json
RUN npm install --omit=dev \
  --workspaces \
  --include-workspace-root \
  --workspace @libs/http \
  --workspace @libs/validation \
  --workspace @services/ride-service

COPY services/ride-service ./services/ride-service
WORKDIR /app/services/ride-service
CMD ["node", "src/server.js"]
