FROM node:20-alpine
WORKDIR /app

COPY services/eta-service/package.json ./package.json
RUN npm install --omit=dev

COPY services/eta-service/src ./src

CMD ["node", "src/server.js"]
