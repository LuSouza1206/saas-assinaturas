# Ledgerflow

SaaS B2B multi-tenant de assinaturas: planos, cobrança recorrente (Stripe) e métricas.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 14 + TypeScript + Tailwind |
| API | Express + TypeScript |
| ORM / DB | Prisma + PostgreSQL |
| Fila | Redis + BullMQ |
| Pagamentos | Stripe |
| Auth | JWT + Google OAuth |
| Observabilidade | Sentry |

## Estrutura

```
apps/
  api/     # Express + Prisma + BullMQ
  web/     # Next.js
docker-compose.yml
.env.example
```

## Setup local

```bash
cp .env.example .env
cp .env.example apps/api/.env
docker compose up -d
npm install
npm run db:migrate -w @saas/api
```

```bash
npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:3000
```

Health: `GET /health`

Se o Redis antigo do Windows ocupar a 6379, rode como Admin: `scripts/disable-windows-redis.ps1`.

## Isolamento multi-tenant

`tenantId` vem do JWT. Services usam `scopedPrisma(tenantId)` para filtrar `plan`, `subscription`, `user` e `invoice`.

```bash
npm run test:isolation -w @saas/api
```

## API

```
POST   /auth/register
POST   /auth/login
GET    /auth/me
GET    /auth/oauth/google
GET    /auth/oauth/google/callback

GET    /plans
POST   /plans              (ADMIN)
PATCH  /plans/:id          (ADMIN)

GET    /subscriptions
POST   /subscriptions
DELETE /subscriptions/:id

POST   /webhooks/stripe
GET    /dashboard/metrics  (ADMIN)
GET    /health
```

## Stripe (local)

```bash
stripe listen --forward-to localhost:4000/webhooks/stripe
```

Cartão de teste: `4242 4242 4242 4242`.

## Deploy

Ver [`docs/DEPLOY.md`](./docs/DEPLOY.md).

- API: Render (`render.yaml`) + Postgres + Redis  
- Web: Vercel, root `apps/web`
