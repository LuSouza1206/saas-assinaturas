# Deploy — Ledgerflow

Ordem: credenciais → API (Render) → Web (Vercel) → webhook Stripe.

---

## 1. Resend (e-mail real)

1. Crie conta em https://resend.com  
2. **API Keys → Create** → copie `re_...`  
3. (Dev) use o from padrão `Ledgerflow <onboarding@resend.dev>`  
4. (Prod) verifique seu domínio e use `EMAIL_FROM=Ledgerflow <billing@seudominio.com>`

Env:
```env
RESEND_API_KEY=re_...
EMAIL_FROM="Ledgerflow <onboarding@resend.dev>"
```

---

## 2. Sentry (observabilidade)

1. https://sentry.io → Create project **Node** (API) e **Next.js**/Browser (web)  
2. Copie os DSNs:

```env
SENTRY_DSN=https://...@o....ingest.sentry.io/...
NEXT_PUBLIC_SENTRY_DSN=https://...@o....ingest.sentry.io/...
```

A API já captura falhas de billing; o front carrega Sentry se `NEXT_PUBLIC_SENTRY_DSN` existir.

---

## 3. Google OAuth

1. https://console.cloud.google.com → APIs & Services → Credentials  
2. Configure a tela de consentimento (External / Testing)  
3. **Create OAuth client ID** → Web application  
4. Authorized redirect URIs:
   - Local: `http://localhost:4000/auth/oauth/google/callback`
   - Prod: `https://SUA-API.onrender.com/auth/oauth/google/callback`
5. Copie Client ID e Secret:

```env
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_CALLBACK_URL=https://SUA-API.onrender.com/auth/oauth/google/callback
```

Fluxo no app: informe o **workspace** → **Continuar com Google**.  
O workspace precisa existir (cadastro com senha primeiro).

---

## 4. Deploy API — Render

1. Push do repo no GitHub  
2. https://dashboard.render.com → **New → Blueprint** → selecione o repo (`render.yaml`)  
3. Preencha env vars marcadas `sync: false` (Stripe, Sentry, Resend, Google, `FRONTEND_URL`)  
4. Após o deploy, anote a URL: `https://ledgerflow-api.onrender.com`  
5. Rode migrate automaticamente no boot (`prisma migrate deploy`)  
6. Stripe webhook de produção:
   - Dashboard Stripe → Webhooks → Add endpoint  
   - URL: `https://ledgerflow-api.onrender.com/webhooks/stripe`  
   - Eventos: `checkout.session.completed`, `invoice.*`, `customer.subscription.*`  
   - Cole o `whsec_...` em `STRIPE_WEBHOOK_SECRET`

Health: `GET /health`

---

## 5. Deploy Web — Vercel

1. https://vercel.com → Import repo  
2. **Root Directory:** `apps/web`  
3. Framework: Next.js  
4. Env:
```env
NEXT_PUBLIC_API_URL=https://ledgerflow-api.onrender.com
NEXT_PUBLIC_SENTRY_DSN=...
```
5. Deploy → anote `https://seu-app.vercel.app`  
6. Volte no Render e set `FRONTEND_URL=https://seu-app.vercel.app` (CORS)  
7. No Google OAuth, adicione a origem do front se pedir

---

## 6. Checklist rápido pós-deploy

- [ ] `/health` → db up, redis up  
- [ ] Register no front de produção  
- [ ] Criar plano + Checkout Stripe (test mode)  
- [ ] Login com Google (workspace preenchido)  
- [ ] Forçar erro de billing e ver evento no Sentry (opcional)  
- [ ] Job de e-mail com `RESEND_API_KEY` chega na caixa

---

## Variáveis por serviço

| Variável | API (Render) | Web (Vercel) |
|----------|--------------|--------------|
| `DATABASE_URL` | sim (auto) | — |
| `REDIS_URL` | sim (auto) | — |
| `JWT_SECRET` | sim | — |
| `FRONTEND_URL` | sim | — |
| `NEXT_PUBLIC_API_URL` | — | sim |
| `STRIPE_*` | sim | — |
| `SENTRY_DSN` | sim | — |
| `NEXT_PUBLIC_SENTRY_DSN` | — | sim |
| `RESEND_API_KEY` | sim | — |
| `GOOGLE_*` | sim | — |
