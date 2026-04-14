# Backend

This directory contains the NestJS backend for the poker bookkeeping mini program.

## What is included

- NestJS project skeleton
- Prisma data model for MySQL
- Core accounting and settlement domain logic
- Environment variable template for local development and CloudBase deployment

## What you need before real deployment

- CloudBase environment ID
- MySQL connection string
- WeChat mini program `appId` and `appSecret`

Redis is optional for MVP v1. The current plan is:

- local development: NestJS + local MySQL
- production: CloudBase Cloud Run + CloudBase MySQL
- Redis: add later only if multi-instance realtime sync becomes necessary

## Recommended next steps

1. Install dependencies in `backend/`
2. Fill `.env` based on `.env.example`
3. Run `npx prisma generate`
4. Run the first migration against your local MySQL
5. Start implementing controllers and repositories
