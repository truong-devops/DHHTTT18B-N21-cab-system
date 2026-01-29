# auth-service

Auth microservice using Express + PostgreSQL.

## Features

- Register / Login / Refresh / Logout
- JWT access token + refresh token
- Bcrypt password hashing
- Basic role support (user/admin/driver)
- Token verification endpoint for API Gateway

## Environment

- `PORT` (default: 4001)
- `DATABASE_URL` (required)
- `JWT_SECRET` (required)
- `JWT_EXPIRES_IN` (default: `15m`)
- `REFRESH_TOKEN_TTL_DAYS` (default: `7`)
- `BCRYPT_ROUNDS` (default: `10`)
- `AUTH_ROLES` (default: `user,admin,driver`)

## Database

Run schema:

```bash
psql "$DATABASE_URL" -f ./migrations/001_init.sql
```

## Run locally

```bash
npm install
DATABASE_URL=postgres://cab:cabpass@localhost:5432/auth-service_db \
JWT_SECRET=dev-secret \
npm start
```

## Docker

```bash
docker build -t auth-service .
docker run -p 4001:4001 \
  -e DATABASE_URL=postgres://cab:cabpass@host.docker.internal:5432/auth-service_db \
  -e JWT_SECRET=dev-secret \
  auth-service
```

## API

- POST `/auth/register`
- POST `/auth/login`
- POST `/auth/refresh`
- POST `/auth/logout`
- GET `/auth/verify`

Example payloads:

```json
// register
{ "email": "user@example.com", "password": "secret123", "role": "user" }
```

```json
// login
{ "identifier": "user@example.com", "password": "secret123" }
```

```json
// refresh
{ "refreshToken": "<token>" }
```
