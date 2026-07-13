import 'server-only';
import { createMonerooProvider, type MonerooProviderHandle } from '@/lib/server/payments/moneroo';
import { createStripeProvider, type StripeProviderHandle } from '@/lib/server/payments/stripe';
import { CircuitBreaker } from '@/lib/server/payments/circuit-breaker';

export class PaymentProviderUnconfiguredError extends Error {
  constructor(message?: string) {
    super(
      message ??
        'Payment provider not configured (MONEROO_SECRET_KEY / MONEROO_WEBHOOK_SECRET missing)',
    );
    this.name = 'PaymentProviderUnconfiguredError';
  }
}

/** Union of the charge-capable providers the kit ships. */
export type ChargeProvider = MonerooProviderHandle | StripeProviderHandle;

let monerooProvider: MonerooProviderHandle | null = null;
let stripeProvider: StripeProviderHandle | null = null;

function monerooConfigured(): boolean {
  return !!(process.env.MONEROO_SECRET_KEY && process.env.MONEROO_WEBHOOK_SECRET);
}

function stripeConfigured(): boolean {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

/**
 * Which provider handles charges. Moneroo is the default (principal); Stripe
 * is the alternative. Selection order:
 *   1. explicit PAYMENT_PROVIDER env ("moneroo" | "stripe")
 *   2. otherwise Moneroo — UNLESS only Stripe is configured, in which case
 *      Stripe takes over so a Stripe-only fork works with zero extra wiring.
 */
export function selectedProviderKind(): 'moneroo' | 'stripe' {
  const explicit = process.env.PAYMENT_PROVIDER;
  if (explicit === 'stripe') return 'stripe';
  if (explicit === 'moneroo') return 'moneroo';
  if (stripeConfigured() && !monerooConfigured()) return 'stripe';
  return 'moneroo';
}

/**
 * Moneroo-specific handle (exposes `verifyPayment`). Used by the Moneroo
 * verify + webhook routes. Throws when Moneroo isn't configured.
 */
export function getProvider(): MonerooProviderHandle {
  if (monerooProvider) return monerooProvider;

  const secretKey = process.env.MONEROO_SECRET_KEY ?? '';
  const webhookSecret = process.env.MONEROO_WEBHOOK_SECRET ?? '';
  if (!secretKey || !webhookSecret) {
    throw new PaymentProviderUnconfiguredError();
  }

  monerooProvider = createMonerooProvider({
    MONEROO_SECRET_KEY: secretKey,
    MONEROO_WEBHOOK_SECRET: webhookSecret,
    ...(process.env.MONEROO_API_URL ? { MONEROO_API_URL: process.env.MONEROO_API_URL } : {}),
  });
  return monerooProvider;
}

/** Stripe-specific handle. Throws when Stripe isn't configured. */
export function getStripeProvider(): StripeProviderHandle {
  if (stripeProvider) return stripeProvider;

  const secretKey = process.env.STRIPE_SECRET_KEY ?? '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
  if (!secretKey || !webhookSecret) {
    throw new PaymentProviderUnconfiguredError(
      'Stripe provider not configured (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET missing)',
    );
  }

  stripeProvider = createStripeProvider({
    STRIPE_SECRET_KEY: secretKey,
    STRIPE_WEBHOOK_SECRET: webhookSecret,
    ...(process.env.STRIPE_API_URL ? { STRIPE_API_URL: process.env.STRIPE_API_URL } : {}),
  });
  return stripeProvider;
}

/**
 * The active charge provider, honoring PAYMENT_PROVIDER / configured keys.
 * Prefer this in provider-agnostic call sites (e.g. the orders route) — it
 * returns whichever adapter is selected. Both adapters implement `charge`
 * and expose a `webhookProvider`.
 */
export function getChargeProvider(): ChargeProvider {
  return selectedProviderKind() === 'stripe' ? getStripeProvider() : getProvider();
}

export const breaker = new CircuitBreaker({
  name: 'moneroo.charge',
  failureThreshold: 5,
  windowMs: 30_000,
  cooldownMs: 60_000,
});

export function __resetProviderSingleton(): void {
  monerooProvider = null;
  stripeProvider = null;
}
