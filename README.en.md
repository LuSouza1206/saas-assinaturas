<div align="center">

# Ledgerflow

<p>
  <a href="./README.md">PT</a> · <strong>EN</strong>
</p>

<p>B2B multi-tenant subscription SaaS — Stripe, BullMQ, and tenant isolation backed by an automated test.</p>

<p>
  <img alt="multi-tenant" src="https://img.shields.io/badge/architecture-multi--tenant-0A66C2" />
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-14-000000" />
  <img alt="Express" src="https://img.shields.io/badge/Node-Express-000000" />
  <img alt="Stripe" src="https://img.shields.io/badge/billing-Stripe-635BFF" />
  <img alt="BullMQ" src="https://img.shields.io/badge/queue-BullMQ-000000" />
</p>

</div>

---

## Table of contents

- [Stack](#stack)
- [Architecture](#architecture)
- [Multi-tenancy](#multi-tenancy)
- [Recurring billing (queue)](#recurring-billing-queue)
- [Auth](#auth)
- [Security](#security)
- [Observability](#observability)
- [Folder structure](#folder-structure)
- [API endpoints](#api-endpoints)
- [Running locally](#running-locally)
- [Testing tenant isolation](#testing-tenant-isolation)
- [Deploy](#deploy)
- [Technical decisions](#technical-decisions)

---

## Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind | Simple SSR for the dashboard, native Vercel fit |
| API | Node.js + Express + TypeScript | Explicit middleware order (needed for Stripe raw-body webhooks) |
| ORM / DB | Prisma + PostgreSQL | Versioned migrations, schema-generated types |
| Queue | Redis + BullMQ | Keeps recurring charges and email off the request/response path |
| Payments | Stripe (Checkout + Webhooks) | Recurring billing without storing card data |
| Auth | JWT + OAuth2 (Google via Passport) | Password login + social, no paid auth vendor |
| Email | Resend | Simple API, console fallback in dev |
| Observability | Sentry | Exceptions in API and workers with tenant context |
| Deploy | Render (API + Postgres + Redis) / Vercel (web) | `render.yaml` Blueprint for infra |

---

## Architecture

```
┌─────────────┐        ┌──────────────────┐        ┌─────────────┐
│  Next.js Web │ ─────▶ │   Express API     │ ─────▶ │ PostgreSQL   │
│  (Vercel)    │ ◀───── │   (Render)        │ ◀───── │ (Render)     │
└─────────────┘        └────────┬─────────┘        └─────────────┘
                                  │
                        ┌─────────┴─────────┐
                        │                    │
                  ┌──────────┐        ┌──────────┐
                  │  Redis    │        │  Stripe   │
                  │  BullMQ   │        │ Webhooks  │
                  └────┬─────┘        └──────────┘
                       │
             ┌──────────┴───────────┐
             │                       │
      ┌─────────────┐        ┌─────────────┐
      │Billing Worker│        │Email Worker  │
      │              │───────▶│  (Resend)    │
      └─────────────┘        └─────────────┘
             │
        ┌─────────┐
        │ Sentry   │  ◀── worker failures with tenantId / subscriptionId
        └─────────┘
```

The API runs two BullMQ workers in the same process (`bootstrap()` in `server.ts`). If Redis is too old for BullMQ (&lt; 5), the API still boots and only the workers stay off — a non-critical dependency does not take the whole service down.

---

## Multi-tenancy

Each company is a `Tenant`. Sensitive tables (`User`, `Plan`, `Subscription`, `Invoice`) carry `tenantId`. Isolation does not rely on remembering a filter on every route:

1. `tenantResolver` reads `tenantId` **from the JWT** (never from body/query) into `req.tenantId`.
2. Services use `scopedPrisma(tenantId)`, which injects `tenantId` into `findMany`, `findFirst`, `create`, `update`, and `delete`.
3. For `findUnique` / `update` / `delete`, the wrapper loads the row first and checks `tenantId` — another tenant’s id returns “not found”, never a leak.

Forgetting `where: { tenantId }` in a new route does not break isolation — protection lives in the data-access layer.

**Automated proof:** `scripts/test-isolation.ts` creates two tenants, adds a plan on Tenant A, and asserts Tenant B cannot list it. See [Testing tenant isolation](#testing-tenant-isolation).

---

## Recurring billing (queue)

Billing is background work (cron), not a user click — it must retry on failure without blocking API routes.

1. `billing.cron.ts` finds subscriptions whose `currentPeriodEnd` is due.
2. Each becomes a job on `billing.queue` (BullMQ/Redis).
3. `billing.worker.ts`:
   - With Stripe configured, charges the pending invoice.
   - Success: advances `currentPeriodEnd`, `status: active`, paid `Invoice`, confirmation email.
   - Failure: `status: past_due`, failed `Invoice`, **Sentry with context**, warning email; rethrows so BullMQ can retry.
4. `email.worker.ts` sends via Resend; without `RESEND_API_KEY` it falls back to `safeLog`.

---

## Auth

- **Password register/login:** signed JWT (`sub`, `tenantId`, `email`, `role`).
- **Google OAuth:** user enters the workspace subdomain first — the tenant must already exist.
- **Roles:** `requireRole("ADMIN")` for plans and `/dashboard/metrics`. `MEMBER` can only manage their own subscription.
- **`GET /auth/providers`** tells the UI whether Google is enabled.

---

## Security

- `helmet()` on all responses.
- CORS locked to `FRONTEND_URL` (never `*`).
- Rate limits: auth `5` / 15 min in prod; API `120` / min in prod (looser in dev).
- Recursive body sanitization (`<>`, `javascript:`); sensitive keys are never logged.
- `safeLog()` redacts secrets in worker logs.
- Stripe webhook uses isolated `express.raw()` **before** the JSON parser.

---

## Observability

Sentry covers unhandled API errors and worker failures, with extras like `tenantId`, `subscriptionId`, `jobId`. Without `SENTRY_DSN`, `captureException` falls back to `console.error`.

`GET /health` checks Postgres (`SELECT 1`) and Redis (`PING`) and returns `503` if either is down.

---

## Folder structure

```
apps/
├── api/
│   ├── prisma/
│   ├── scripts/test-isolation.ts
│   └── src/
│       ├── modules/   # auth, tenants, plans, subscriptions, billing, users
│       ├── jobs/      # billing + email queues/workers/cron
│       ├── middleware/
│       ├── config/
│       └── lib/       # scopedPrisma, errors
└── web/
    └── app/           # marketing, auth, dashboard
docs/
├── DEPLOY.md
├── CREDENTIALS-CHECKLIST.md
└── STRIPE-SETUP.md
docker-compose.yml
render.yaml
```

---

## API endpoints

```
Auth
POST   /auth/register
POST   /auth/login
GET    /auth/me
GET    /auth/providers
GET    /auth/oauth/google          ?subdomain=
GET    /auth/oauth/google/callback

Plans
GET    /plans
POST   /plans                      (ADMIN)
PATCH  /plans/:id                  (ADMIN)

Subscriptions
GET    /subscriptions
POST   /subscriptions
DELETE /subscriptions/:id

Dashboard
GET    /dashboard/metrics          (ADMIN)

Billing
POST   /webhooks/stripe

Infra
GET    /health
```

---

## Running locally

Requires Node 18+ and Docker.

```bash
git clone https://github.com/LuSouza1206/saas-assinaturas.git
cd saas-assinaturas

cp .env.example .env
cp .env.example apps/api/.env

docker compose up -d

npm install
npm run db:migrate -w @saas/api

npm run dev:api                # http://localhost:4000
npm run dev:web                # http://localhost:3000
```

> Windows: if port 6379 is taken by native Redis, run `scripts/disable-windows-redis.ps1` as Administrator.

**Local Stripe** (optional):

```bash
stripe listen --forward-to localhost:4000/webhooks/stripe
```

Test card: `4242 4242 4242 4242`.

Without Stripe keys, subscriptions are created locally (`local_` ids) so development still works.

---

## Testing tenant isolation

```bash
npm run test:isolation -w @saas/api
```

Creates Tenant A and B, adds a plan on A, and fails (`exit 1`) if B can see it.

---

## Deploy

Full guide: [`docs/DEPLOY.md`](./docs/DEPLOY.md). Checklist: [`docs/CREDENTIALS-CHECKLIST.md`](./docs/CREDENTIALS-CHECKLIST.md).

1. Resend  
2. Sentry  
3. Google OAuth  
4. **Render** API (`render.yaml`)  
5. **Vercel** web (`apps/web` → `NEXT_PUBLIC_API_URL`)  
6. Stripe production webhook → Render URL  

---

## Technical decisions

- **Express over Nest/Fastify:** explicit middleware order for Stripe `express.raw()`.
- **`scopedPrisma` over Postgres RLS:** simpler for this stage; RLS is a natural next step for a larger team.
- **Workers in the same API process:** lower infra cost; Redis &lt; 5 skips workers without killing the API.
- **Local Stripe fallback:** demo and develop without always needing live credentials.
