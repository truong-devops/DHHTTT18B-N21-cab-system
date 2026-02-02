FROM node:20-alpine

WORKDIR /app

# Copy workspace manifests needed for dependency install
COPY package*.json ./
COPY services/payment-service/package*.json ./services/payment-service/
COPY libs/validation/package*.json ./libs/validation/
COPY libs/http/package*.json ./libs/http/

RUN npm install

# Copy source
COPY services/payment-service ./services/payment-service
COPY libs/validation ./libs/validation
COPY libs/http ./libs/http
COPY contracts/events ./contracts/events

WORKDIR /app/services/payment-service
EXPOSE 3000
CMD ["npm", "run", "start"]
