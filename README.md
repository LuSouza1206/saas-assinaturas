<div align="center">

# Ledgerflow

<p>
  <strong>PT</strong> · <a href="./README.en.md">EN</a>
</p>

<p>SaaS B2B multi-tenant de assinaturas — Stripe, BullMQ e isolamento por tenant com teste automatizado.</p>

<p>
  <a href="https://saas-assinaturas-web-pearl.vercel.app"><strong>Demo</strong></a>
  ·
  <a href="https://ledgerflow-api-mc1h.onrender.com/health"><strong>API</strong></a>
</p>

<p>
  <a href="https://saas-assinaturas-web-pearl.vercel.app">
    <img alt="status: live" src="https://img.shields.io/badge/status-live-0A66C2" />
  </a>
  <img alt="multi-tenant" src="https://img.shields.io/badge/architecture-multi--tenant-0A66C2" />
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-14-000000" />
  <img alt="Express" src="https://img.shields.io/badge/Node-Express-000000" />
  <img alt="Stripe" src="https://img.shields.io/badge/billing-Stripe-635BFF" />
  <img alt="BullMQ" src="https://img.shields.io/badge/queue-BullMQ-000000" />
</p>

</div>

---

## Índice

- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Multi-tenancy](#multi-tenancy)
- [Fluxo de cobrança recorrente (fila)](#fluxo-de-cobrança-recorrente-fila)
- [Autenticação e autorização](#autenticação-e-autorização)
- [Segurança](#segurança)
- [Observabilidade](#observabilidade)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Endpoints da API](#endpoints-da-api)
- [Rodando localmente](#rodando-localmente)
- [Testando o isolamento multi-tenant](#testando-o-isolamento-multi-tenant)
- [Deploy](#deploy)
- [Decisões técnicas e trade-offs](#decisões-técnicas-e-trade-offs)

---

## Stack

| Camada | Tecnologia | Por quê |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind | SSR simples pro dashboard, integração nativa com Vercel |
| API | Node.js + Express + TypeScript | Controle explícito de middleware (útil pro webhook raw-body do Stripe) |
| ORM / Banco | Prisma + PostgreSQL | Migrations versionadas, tipagem gerada a partir do schema |
| Fila | Redis + BullMQ | Desacopla cobrança recorrente e envio de e-mail do ciclo de request/response |
| Pagamentos | Stripe (Checkout + Webhooks) | Cobrança recorrente sem guardar dado de cartão |
| Auth | JWT + OAuth2 (Google, via Passport) | Login próprio + social, sem depender de terceiro pago |
| E-mail | Resend | API simples, fallback pra log em dev |
| Observabilidade | Sentry | Captura de exceções na API e nos workers, com contexto de tenant |
| Deploy | Render (API + Postgres + Redis) / Vercel (web) | `render.yaml` como Blueprint, zero clique manual de infra |

---

## Arquitetura

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
      │ (cobrança)   │───────▶│  (Resend)    │
      └─────────────┘        └─────────────┘
             │
        ┌─────────┐
        │ Sentry   │  ◀── captura falhas dos workers com contexto (tenantId, subscriptionId)
        └─────────┘
```

A API roda dois workers BullMQ no mesmo processo (`bootstrap()` em `server.ts`), com fallback: se o Redis disponível não suportar BullMQ (versão < 5), a API sobe mesmo assim e só os workers ficam desativados — evita que uma dependência não crítica derrube o serviço inteiro.

---

## Multi-tenancy

Cada empresa cadastrada é um `Tenant`. Toda tabela sensível (`User`, `Plan`, `Subscription`, `Invoice`) carrega `tenantId`, e a regra de isolamento não depende de o desenvolvedor lembrar de filtrar manualmente em cada rota:

1. O middleware `tenantResolver` extrai o `tenantId` **do JWT** (nunca do body ou de query params) e injeta em `req.tenantId`.
2. Os services nunca chamam o Prisma cru — usam `scopedPrisma(tenantId)`, um wrapper que injeta `tenantId` automaticamente em todo `findMany`, `findFirst`, `create`, `update` e `delete` das entidades multi-tenant.
3. Em `findUnique` e `update`/`delete`, o wrapper busca o registro primeiro e confere se o `tenantId` bate antes de expor ou alterar qualquer coisa — um ID de outro tenant simplesmente retorna "não encontrado", nunca vaza dado nem erro revelador.

Isso significa que esquecer um filtro `where: { tenantId }` numa rota nova não quebra o isolamento — a proteção vive na camada de acesso a dado, não em cada controller.

**Prova automatizada:** `scripts/test-isolation.ts` cria dois tenants do zero, cadastra um plano no Tenant A e confirma que o Tenant B não consegue listá-lo. Ver seção [Testando o isolamento](#testando-o-isolamento-multi-tenant).

---

## Fluxo de cobrança recorrente (fila)

Por que fila em vez de cobrar direto no request: cobrança recorrente não é acionada por um clique do usuário, é um processo de fundo (cron) que precisa reprocessar em caso de falha sem travar nenhuma rota da API.

1. `billing.cron.ts` dispara periodicamente e identifica assinaturas com `currentPeriodEnd` vencendo.
2. Cada uma vira um job na fila `billing.queue` (BullMQ/Redis).
3. `billing.worker.ts` processa o job:
   - Se o Stripe estiver configurado, cobra a fatura pendente via API do Stripe.
   - Em caso de sucesso: avança `currentPeriodEnd`, marca `status: active`, cria um `Invoice` pago, enfileira e-mail de confirmação.
   - Em caso de falha: marca `status: past_due`, cria `Invoice` com `status: failed`, **envia o erro pro Sentry com o contexto** (`tenantId`, `subscriptionId`), e enfileira e-mail de aviso — o erro é relançado (`throw err`) pra o BullMQ registrar a falha e permitir retry.
4. `email.worker.ts` consome a fila de e-mail e envia via Resend; se `RESEND_API_KEY` não estiver configurada, cai em log estruturado (`safeLog`) sem quebrar o fluxo — útil em dev.

---

## Autenticação e autorização

- **Registro/login com senha:** JWT assinado (`jsonwebtoken`), payload contém `sub`, `tenantId`, `email`, `role`.
- **Login social:** Google OAuth via Passport. O usuário informa o `subdomain` do workspace antes de continuar com o Google — o workspace precisa existir primeiro (registro com senha cria o tenant).
- **Autorização por papel:** guard `requireRole("ADMIN")` protege rotas como criação/edição de planos e `/dashboard/metrics`. Usuários `MEMBER` só assinam e cancelam a própria assinatura.
- **`GET /auth/providers`** informa ao frontend se o Google OAuth está configurado no ambiente atual, pra esconder o botão quando não estiver.

---

## Segurança

- `helmet()` em todas as respostas.
- CORS restrito à origem exata do frontend (`FRONTEND_URL`), nunca `*`.
- Rate limiting diferenciado: rotas de auth (`5` tentativas / 15 min em produção) e rate limit geral da API (`120` req/min em produção) — limites mais permissivos automaticamente em dev.
- Sanitização recursiva de todo `req.body` (remove `<`, `>`, `javascript:`), com uma lista de chaves sensíveis (`password`, `token`, `card`, `cvv` etc.) que é preservada sem sanitizar o valor mas nunca logada.
- `safeLog()` — helper de log que redige automaticamente qualquer chave sensível antes de escrever no console, usado nos workers pra nunca vazar dado de pagamento em log.
- Webhook do Stripe usa `express.raw()` isolado (precisa do body cru pra validar a assinatura) e roda **antes** do parser JSON e do restante do middleware de segurança.

---

## Observabilidade

Sentry captura exceções tanto na API (erros não tratados de rota, via `setupSentryExpress`) quanto nos workers (falha de cobrança, falha de envio de e-mail), sempre com contexto extra: `tenantId`, `subscriptionId`, `jobId`, fila de origem. Se `SENTRY_DSN` não estiver configurado, o próprio `captureException` cai em `console.error` — o projeto funciona sem a integração, só sem o rastreamento centralizado.

O endpoint `GET /health` verifica conectividade real com Postgres (`SELECT 1`) e Redis (`PING`), retornando `503` se qualquer um estiver fora — usado pelo Render e pela checklist de pós-deploy.

---

## Estrutura de pastas

```
apps/
├── api/
│   ├── prisma/
│   │   ├── schema.prisma        # Tenant, User, Plan, Subscription, Invoice
│   │   └── migrations/
│   ├── scripts/
│   │   └── test-isolation.ts    # teste automatizado de isolamento multi-tenant
│   └── src/
│       ├── modules/
│       │   ├── auth/            # JWT, Google OAuth (Passport), guards
│       │   ├── tenants/
│       │   ├── plans/
│       │   ├── subscriptions/   # inclui rota de métricas (MRR, churn)
│       │   ├── billing/         # webhook do Stripe
│       │   └── users/
│       ├── jobs/
│       │   ├── billing.cron.ts
│       │   ├── billing.queue.ts / billing.worker.ts
│       │   └── email.queue.ts / email.worker.ts
│       ├── middleware/
│       │   ├── tenant-resolver.ts
│       │   ├── rate-limit.ts
│       │   └── security.ts      # helmet, CORS, sanitização, safeLog
│       ├── config/
│       │   ├── env.ts / redis.ts / sentry.ts / stripe.ts
│       └── lib/
│           ├── prisma.ts        # scopedPrisma — acesso a dado escopado por tenant
│           └── errors.ts
└── web/
    ├── app/
    │   ├── (marketing)/          # landing page
    │   ├── (auth)/               # login, registro
    │   └── (dashboard)/
    │       ├── dashboard/        # métricas (MRR, churn, assinantes ativos)
    │       ├── plans/
    │       └── subscriptions/
    └── lib/api-client.ts
docs/
├── DEPLOY.md                    # passo a passo completo de deploy
├── CREDENTIALS-CHECKLIST.md
└── STRIPE-SETUP.md
docker-compose.yml                # Postgres + Redis local
render.yaml                       # Blueprint de deploy da API
```

---

## Endpoints da API

```
Auth
POST   /auth/register              cria tenant + usuário ADMIN
POST   /auth/login
GET    /auth/me                    (autenticado)
GET    /auth/providers             informa se Google OAuth está habilitado
GET    /auth/oauth/google          requer ?subdomain=
GET    /auth/oauth/google/callback

Plans
GET    /plans                      (autenticado, escopado por tenant)
POST   /plans                      (ADMIN)
PATCH  /plans/:id                  (ADMIN)

Subscriptions
GET    /subscriptions              (autenticado)
POST   /subscriptions              cria Checkout Session (Stripe) ou assinatura local
DELETE /subscriptions/:id          cancela

Dashboard
GET    /dashboard/metrics          MRR, churn rate, assinantes ativos (ADMIN)

Billing
POST   /webhooks/stripe            valida assinatura, sem JWT

Infra
GET    /health                     status real de DB e Redis
```

---

## Rodando localmente

Pré-requisitos: Node 18+, Docker.

```bash
git clone https://github.com/LuSouza1206/saas-assinaturas.git
cd saas-assinaturas

cp .env.example .env
cp .env.example apps/api/.env

docker compose up -d          # Postgres (5432) + Redis (6380 externo → 6379 interno)

npm install
npm run db:migrate -w @saas/api

npm run dev:api                # http://localhost:4000
npm run dev:web                # http://localhost:3000
```

> Windows: se a porta 6379 já estiver ocupada por um Redis nativo, rode `scripts/disable-windows-redis.ps1` como administrador.

**Stripe local** (opcional, pra testar cobrança de ponta a ponta):

```bash
stripe listen --forward-to localhost:4000/webhooks/stripe
```

Cartão de teste: `4242 4242 4242 4242` (qualquer validade futura e CVC).

Sem chave da Stripe configurada, o sistema não quebra: `subscriptions.service.ts` detecta `isStripeConfigured() === false` e cria a assinatura localmente (`stripeSubId` prefixado com `local_`), útil pra desenvolver sem depender da conta Stripe o tempo todo.

---

## Testando o isolamento multi-tenant

```bash
npm run test:isolation -w @saas/api
```

O script cria dois tenants (`Tenant A` e `Tenant B`) do zero, cadastra um plano em A e confirma programaticamente que B não consegue vê-lo na própria listagem — falha o processo (`exit 1`) se houver qualquer vazamento. Não é uma verificação manual, é a garantia de que a proteção descrita em [Multi-tenancy](#multi-tenancy) realmente funciona antes de qualquer deploy.

---

## Deploy

**Produção**
- Demo: https://saas-assinaturas-web-pearl.vercel.app  
- API: https://ledgerflow-api-mc1h.onrender.com (`/health`)

Guia completo em [`docs/DEPLOY.md`](./docs/DEPLOY.md) e checklist de credenciais em [`docs/CREDENTIALS-CHECKLIST.md`](./docs/CREDENTIALS-CHECKLIST.md). Resumo da ordem:

1. **Resend** — API key pra e-mail real (com fallback de log se ausente)
2. **Sentry** — DSN separado pra API (Node) e web (Next.js/Browser)
3. **Google OAuth** — client ID/secret, redirect URI local e de produção
4. **API no Render** — Blueprint via `render.yaml` (Postgres + Redis gerenciados, migrations automáticas no boot)
5. **Web no Vercel** — root `apps/web`, variáveis apontando pra API do Render
6. **Webhook do Stripe em produção** apontando pra URL do Render

Checklist pós-deploy: `/health` respondendo `db: up` e `redis: up`, registro funcionando em produção, checkout Stripe em modo teste, login Google, e (opcional) forçar uma falha de billing pra confirmar que aparece no Sentry.

---

## Decisões técnicas e trade-offs

- **Express em vez de NestJS/Fastify:** controle explícito da ordem de middleware foi necessário pro webhook do Stripe (precisa de `express.raw()` isolado, antes do parser JSON global) — mais simples de garantir manualmente em Express do que lutar contra a estrutura de decorators de um framework opinativo.
- **`scopedPrisma` como wrapper manual em vez de RLS (Row-Level Security) do Postgres:** RLS teria isolamento mais forte a nível de banco, mas exigiria configurar policies por tabela e gerenciar o contexto de sessão do Postgres a partir da conexão do Prisma — trade-off consciente de simplicidade agora, com a ressalva de que RLS seria o próximo passo natural pra um ambiente de produção real com múltiplos desenvolvedores.
- **Workers no mesmo processo da API** (não um serviço separado): reduz custo de infra pro estágio atual do projeto; o fallback de "Redis sem suporte a BullMQ não derruba a API" existe justamente porque workers e API convivem no mesmo boot.
- **Fallback local sem Stripe configurado:** permite desenvolver e demonstrar o fluxo de assinatura sem depender de credencial de terceiro sempre disponível — importante pra rodar o projeto localmente sem fricção.
