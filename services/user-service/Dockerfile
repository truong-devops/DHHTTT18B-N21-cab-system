FROM node:20-alpine

WORKDIR /app

COPY services/user-service/package*.json ./
RUN npm install

COPY services/user-service ./

EXPOSE 4002
CMD ["npm", "run", "start"]
