FROM node:20-alpine

WORKDIR /app

# copy package
COPY services/auth-service/package*.json ./
RUN npm install

# copy source
COPY services/auth-service ./

EXPOSE 4001
CMD ["npm", "run", "start"]
