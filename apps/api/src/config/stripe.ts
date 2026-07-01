import Stripe from "stripe";
import { env } from "./env";

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!env.stripeSecretKey || env.stripeSecretKey.startsWith("sk_test_...")) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  if (!stripe) {
    stripe = new Stripe(env.stripeSecretKey, {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    });
  }

  return stripe;
}

export function isStripeConfigured(): boolean {
  return Boolean(
    env.stripeSecretKey && !env.stripeSecretKey.startsWith("sk_test_...")
  );
}
