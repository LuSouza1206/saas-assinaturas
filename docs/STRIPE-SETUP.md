# Setup Stripe (modo test)

## 1. Conta e chaves

1. https://dashboard.stripe.com — ative **Test mode**
2. **Developers → API keys**
3. Copie Secret key (`sk_test_...`) e Publishable key (`pk_test_...`)

## 2. Variáveis

Em `.env` e `apps/api/.env`:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Reinicie a API.

## 3. Webhooks locais

```powershell
stripe login
stripe listen --forward-to localhost:4000/webhooks/stripe
```

Cole o `whsec_...` em `STRIPE_WEBHOOK_SECRET` e reinicie a API.

## Checkout

1. No app: **Assinar com Stripe**
2. Cartão: `4242 4242 4242 4242` · validade futura · CVC qualquer
3. Retorno em `/subscriptions?checkout=success`
4. Webhooks gravam `Subscription` + `Invoice`
