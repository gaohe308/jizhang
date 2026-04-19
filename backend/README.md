# Backend

This directory contains the NestJS backend for the poker bookkeeping mini program.

## Current Stack

- NestJS
- Prisma + CloudBase MySQL
- WeChat mini program login
- CloudBase HTTP cloud function deployment

## Local Development

1. Install dependencies in `backend/`.
2. Fill `.env` based on `.env.example`.
3. Run `npm run prisma:generate`.
4. Run `npm run prisma:migrate:dev -- --name init`.
5. Run `npm run start:dev`.

## CloudBase Deployment

The backend source is built into `cloudfunctions/backend-http/` for deployment.

From the project root:

```powershell
npm run build:backend-http
```

The generated function package uses:

- `cloudfunctions/backend-http/index.js`
- `cloudfunctions/backend-http/scf_bootstrap`
- `cloudfunctions/backend-http/package.json`

## Required Environment Variables

- `APP_RUNTIME`
- `CLOUDBASE_ENV_ID`
- `DATABASE_URL`
- `HTTP_FUNCTION_PORT`
- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `PRISMA_CONNECT_TIMEOUT_MS` (optional)
- `PRISMA_CONNECT_MAX_RETRIES` (optional)
- `PRISMA_CONNECT_RETRY_DELAY_MS` (optional)

## Notes

- Redis is optional for MVP v1 and is not required right now.
- The mini program request base URL should point to the CloudBase HTTP function service domain.
