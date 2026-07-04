# Checklist de credenciais

## Resend — https://resend.com
- [ ] Conta criada
- [ ] API Key `re_...`
- [ ] (Prod) domínio verificado

## Sentry — https://sentry.io
- [ ] Projeto Node → `SENTRY_DSN`
- [ ] Projeto Browser/Next → `NEXT_PUBLIC_SENTRY_DSN`

## Google Cloud — https://console.cloud.google.com
- [ ] OAuth consent screen
- [ ] Client ID Web
- [ ] Redirect local: `http://localhost:4000/auth/oauth/google/callback`
- [ ] Redirect prod: `https://SUA-API.onrender.com/auth/oauth/google/callback`

## Render — https://dashboard.render.com
- [ ] Blueprint com `render.yaml`
- [ ] Env: JWT, Stripe, Sentry, Resend, Google, FRONTEND_URL

## Vercel — https://vercel.com
- [ ] Import repo, root `apps/web`
- [ ] Env: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SENTRY_DSN`

## Stripe produção
- [ ] Webhook → `https://SUA-API/webhooks/stripe`
- [ ] `STRIPE_WEBHOOK_SECRET` atualizado

Detalhes: `docs/DEPLOY.md`
