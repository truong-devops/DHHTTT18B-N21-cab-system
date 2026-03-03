FROM node:20-alpine
WORKDIR /app
ENV NPM_CONFIG_CACHE=/tmp/.npm-cache
COPY package.json ./
RUN npm i --omit=dev
COPY . .
CMD ["node", "src/server.js"]
