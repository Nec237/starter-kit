/**
 * Stripe provider — ALTERNATIVE to Moneroo (Moneroo stays the default).
 *
 * Card + wallet hosted checkout via Stripe Checkout Sessions, plus webhook
 * signature verification. Selected only when PAYMENT_PROVIDER="stripe" (or
 * when only the Stripe keys are present) — see provider-singleton.ts.
 *
 * API: https://api.stripe.com — REST, `application/x-www-form-urlencoded`
 * request bodies (Stripe does NOT accept JSON). No npm `stripe` package is
 * used; we call the REST endpoints directly with `fetch` to keep the
 * dependency surface minimal, mirroring the Moneroo adapter.
 *
 * Auth: `Authorization: Bearer <STRIPE_SECRET_KEY>`.
 *
 * Amount convention (shared with the rest of the kit): `ChargeInput.amount`
 * is the integer smallest currency unit. Stripe's `unit_amount` is also the
 * smallest unit (and XOF is a zero-decimal currency on Stripe) — so the value
 * passes through unchanged.
 *
 * Charge quirks:
 *   - Checkout Sessions need `mode=payment`, a `success_url` AND a
 *     `cancel_url` (unlike Moneroo, which only has return_url).
 *   - A 200 response without both `id` and `url` is a failure.
 *
 * Webhook signature: `Stripe-Signature` = `t=<unix>,v1=<hex-hmac>` where the
 * HMAC-SHA256 is computed over `"<t>.<rawBody>"` with STRIPE_WEBHOOK_SECRET
 * (Dashboard → Developers → Webhooks → signing secret, `whsec_…`).
 *
 * Dev escape hatch: when `process.env.SMOKE_BYPASS_WEBHOOK_VERIFY === '1'`,
 * `verifySignature` returns `{ valid: true }` (loud warning logged). DEV ONLY.
 *
 * Payouts/refunds: not implemented in v1 — the capability-typed
 * `PaymentProvider` interface reports them unavailable.
 */
import crypto from 'node:crypto';
import { createLogger } from '../logger';
import type { WebhookProvider, ParsedIds } from '../webhook/handler';
import type { PaymentProvider, ChargeInput, ChargeResult } from './provider';

const logger = createLogger();

// ───────────────────────────────────────────────────────────────────────
// Env shape
// ───────────────────────────────────────────────────────────────────────

export interface StripeEnv {
  /** Secret key `sk_live_…` / `sk_test_…`. Required. */
  STRIPE_SECRET_KEY: string;
  /** Webhook signing secret `whsec_…`. Required. */
  STRIPE_WEBHOOK_SECRET: string;
  /** Base URL override — defaults to https://api.stripe.com. */
  STRIPE_API_URL?: string;
}

const DEFAULT_API_URL = 'https://api.stripe.com';
const HTTP_TIMEOUT_MS = 30_000;
/** Reject webhook events older than this to blunt replay attacks. */
const SIGNATURE_TOLERANCE_S = 300;

// ───────────────────────────────────────────────────────────────────────
// Webhook payload
// ───────────────────────────────────────────────────────────────────────

export interface StripeWebhookPayload {
  /** "checkout.session.completed" | "payment_intent.succeeded" | … */
  type?: string;
  data?: {
    object?: {
      id?: string;
      client_reference_id?: string;
      payment_status?: string;
      status?: string;
      metadata?: Record<string, string>;
      [key: string]: unknown;
    };
  };
  [key: string]: unknown;
}

// ───────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Flatten a nested object into Stripe's bracket form-encoding, e.g.
 * `{ a: { b: 1 } }` → `a[b]=1`. Values are stringified; null/undefined
 * are dropped.
 */
export function toStripeForm(input: Record<string, unknown>, parentKey?: string): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined) continue;
    const fullKey = parentKey ? `${parentKey}[${key}]` : key;
    if (typeof value === 'object' && !Array.isArray(value)) {
      for (const [k, v] of toStripeForm(value as Record<string, unknown>, fullKey)) {
        params.append(k, v);
      }
    } else {
      params.append(fullKey, typeof value === 'string' ? value : JSON.stringify(value));
    }
  }
  return params;
}

/** Stripe metadata values must be strings — stringify, drop empties. */
export function toStringMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(metadata ?? {})) {
    if (v === null || v === undefined) continue;
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    if (s) out[k] = s;
  }
  return out;
}

function classifyEvent(type: string | undefined): NonNullable<ParsedIds['kind']> {
  const t = (type ?? '').toLowerCase();
  if (t === 'checkout.session.completed' || t === 'payment_intent.succeeded') return 'paid';
  if (t === 'charge.refunded' || t === 'refund.created') return 'refunded';
  if (
    t === 'payment_intent.payment_failed' ||
    t === 'checkout.session.expired' ||
    t === 'charge.failed'
  ) {
    return 'failed';
  }
  return 'other';
}

/** Parse the `Stripe-Signature` header into its `t` and `v1` parts. */
export function parseStripeSignature(
  header: string | undefined,
): { timestamp: string; v1: string } | null {
  if (!header) return null;
  let timestamp = '';
  let v1 = '';
  for (const part of header.split(',')) {
    const [k, val] = part.split('=');
    if (k?.trim() === 't') timestamp = (val ?? '').trim();
    else if (k?.trim() === 'v1') v1 = (val ?? '').trim();
  }
  if (!timestamp || !v1) return null;
  return { timestamp, v1 };
}

// ───────────────────────────────────────────────────────────────────────
// Factory
// ───────────────────────────────────────────────────────────────────────

export interface StripeProviderHandle extends PaymentProvider {
  webhookProvider: WebhookProvider<StripeWebhookPayload>;
}

export function createStripeProvider(env: StripeEnv): StripeProviderHandle {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    throw new Error(
      'Stripe provider misconfigured (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET missing)',
    );
  }
  const apiUrl = (env.STRIPE_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');

  async function charge(input: ChargeInput): Promise<ChargeResult> {
    const form = toStripeForm({
      mode: 'payment',
      success_url: input.successUrl,
      cancel_url: input.failureUrl,
      client_reference_id: input.externalRef,
      ...(input.customer.email ? { customer_email: input.customer.email } : {}),
      line_items: {
        '0': {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: input.amount,
            product_data: { name: `Order ${input.externalRef}` },
          },
        },
      },
      metadata: {
        ...toStringMetadata(input.metadata),
        orderId: input.externalRef,
      },
    });

    const res = await fetch(`${apiUrl}/v1/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });

    const json = (await res.json().catch(() => null)) as {
      id?: string;
      url?: string;
      error?: { message?: string };
    } | null;

    if (!res.ok) {
      throw new Error(
        `Stripe checkout session failed (HTTP ${res.status}): ${
          json?.error?.message ?? 'unknown error'
        }`,
      );
    }
    const id = json?.id;
    const url = json?.url;
    if (!id || !url) {
      throw new Error('Stripe checkout session returned 200 without id/url');
    }

    return {
      providerChargeId: id,
      paymentUrl: url,
      status: 'PENDING',
    };
  }

  const webhookProvider: WebhookProvider<StripeWebhookPayload> = {
    name: 'stripe',

    verifySignature(rawBody, headers) {
      if (process.env.SMOKE_BYPASS_WEBHOOK_VERIFY === '1') {
        logger.warn(
          '[stripe] SMOKE_BYPASS_WEBHOOK_VERIFY=1 — webhook signature verification BYPASSED. DEV ONLY.',
        );
        return { valid: true };
      }
      const parsed = parseStripeSignature(headers['stripe-signature']);
      if (!parsed) return { valid: false, reason: 'Missing or malformed Stripe-Signature header' };

      const age = Math.floor(Date.now() / 1000) - Number(parsed.timestamp);
      if (!Number.isFinite(age) || Math.abs(age) > SIGNATURE_TOLERANCE_S) {
        return { valid: false, reason: 'Timestamp outside tolerance (replay?)' };
      }

      const signedPayload = `${parsed.timestamp}.${rawBody.toString('utf-8')}`;
      const expected = crypto
        .createHmac('sha256', env.STRIPE_WEBHOOK_SECRET)
        .update(signedPayload)
        .digest('hex');
      if (!timingSafeStringEqual(parsed.v1, expected)) {
        return { valid: false, reason: 'HMAC mismatch' };
      }
      return { valid: true };
    },

    parsePayload(rawBody) {
      return JSON.parse(rawBody.toString('utf-8')) as StripeWebhookPayload;
    },

    extractIds(payload) {
      const obj = payload.data?.object;
      const externalId = String(obj?.id ?? '');
      const eventType = String(payload.type ?? 'unknown');
      return {
        externalId,
        eventType,
        kind: classifyEvent(payload.type),
      };
    },
  };

  return {
    name: 'stripe',
    charge,
    webhookProvider,
  };
}
