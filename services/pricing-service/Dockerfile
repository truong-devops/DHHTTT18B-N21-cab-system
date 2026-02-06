FROM node:20-alpine
WORKDIR /app

# Install workspace deps with local libs
COPY package.json package-lock.json ./
COPY libs ./libs
COPY services/pricing-service/package.json services/pricing-service/package.json
RUN npm install --omit=dev \
  --workspaces \
  --include-workspace-root \
  --workspace @libs/validation \
  --workspace @services/pricing-service

COPY services/pricing-service ./services/pricing-service
WORKDIR /app/services/pricing-service
CMD ["node", "src/server.js"]
