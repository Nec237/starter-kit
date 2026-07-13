/**
 * Moneroo provider — hosted checkout (mobile money + card, all-Africa
 * aggregator) and webhook signature verification.
 *
 * API: https://api.moneroo.io (no separate sandbox host — the secret key
 * itself determines test vs live mode).
 *
 * Auth: `Authorization: Bearer <MONEROO_SECRET_KEY>`.
 *
 * Charge quirks (from the izisaas-payments-handler reference):
 *   - `customer.first_name` AND `customer.last_name` are REQUIRED — Moneroo
 *     silently 400s with email-only customers. Single-token names get
 *     last_name = "-"; missing names fall back to the email local-part.
 *   - `metadata` values MUST be strings (422 otherwise) — non-string values
 *     are stringified, empty ones dropped.
 *   - `description` max 200 chars — sliced.
 *   - Only `return_url` exists (no cancel_url) — the failureUrl is encoded
 *     nowhere; the hosted page redirects back with ?paymentStatus=… params.
 *   - A 200 response without BOTH `data.id` and `data.checkout_url` is a
 *     failure.
 *
 * Webhook signature: `X-Moneroo-Signature` = hex HMAC-SHA256 of the raw
 * body with MONEROO_WEBHOOK_SECRET (Dashboard → Developers → Webhooks).
 *
 * Dev escape hatch: when `process.env.SMOKE_BYPASS_WEBHOOK_VERIFY === '1'`,
 * `verifySignature` returns `{ valid: true }` regardless. **DEV ONLY** — a
 * loud warning is logged on every bypass (mirrors the Moneroo adapter).
 *
 * Payouts/refunds: not implemented in v1 — `payout()`/`refund()` are absent
 * so the capability-typed `PaymentProvider` interface reports them
 * unavailable.
 */
import crypto from 'node:crypto';
import { createLogger } from '../logger';
import type { WebhookProvider, ParsedIds } from '../webhook/handler';
import type { PaymentProvider, ChargeInput, ChargeResult } from './provider';

const logger = createLogger();

// ───────────────────────────────────────────────────────────────────────
// Env shape
// ───────────────────────────────────────────────────────────────────────

export interface MonerooEnv {
  /** Secret key for /v1/payments/*. Required. */
  MONEROO_SECRET_KEY: string;
  /** HMAC secret from Dashboard → Developers → Webhooks. Required. */
  MONEROO_WEBHOOK_SECRET: string;
  /** Base URL override — defaults to https://api.moneroo.io. */
  MONEROO_API_URL?: string;
}

const DEFAULT_API_URL = 'https://api.moneroo.io';
const HTTP_TIMEOUT_MS = 30_000;
const DESCRIPTION_MAX_LEN = 200;

// ───────────────────────────────────────────────────────────────────────
// Webhook payload
// ───────────────────────────────────────────────────────────────────────

export interface MonerooWebhookPayload {
  /** "payment.success" | "payment.failed" | "payment.cancelled" | "payment.initiated" | … */
  event?: string;
  data?: {
    id?: string;
    amount?: number;
    currency?: string | { code?: string };
    status?: string;
    metadata?: Record<string, string>;
    [key: string]: unknown;
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
 * Moneroo requires first_name + last_name. Split on whitespace; fall back
 * to the email local-part when no name is available, and "-" for a missing
 * last name.
 */
export function splitCustomerName(
  name: string | undefined,
  email: string | undefined,
): { first_name: string; last_name: string } {
  const trimmed = (name ?? '').trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/);
    const first = parts[0] ?? '-';
    const rest = parts.slice(1).join(' ');
    return { first_name: first, last_name: rest || '-' };
  }
  const local = (email ?? '').split('@')[0] ?? '';
  return { first_name: local || '-', last_name: '-' };
}

/** Moneroo 422s on non-string metadata values — stringify, drop empties. */
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

function classifyEvent(
  event: string | undefined,
  status: string | undefined,
): NonNullable<ParsedIds['kind']> {
  const e = (event ?? '').toLowerCase();
  const s = (status ?? '').toLowerCase();
  if (e === 'payment.success' || s === 'success' || s === 'succeeded') return 'paid';
  if (e === 'payment.refunded' || s === 'refunded' || s === 'refund') return 'refunded';
  if (e === 'payment.failed' || e === 'payment.cancelled' || s === 'failed' || s === 'cancelled') {
    return 'failed';
  }
  // payment.initiated & anything unknown — informational, don't act.
  return 'other';
}

// ───────────────────────────────────────────────────────────────────────
// Factory
// ───────────────────────────────────────────────────────────────────────

export interface MonerooProviderHandle extends PaymentProvider {
  webhookProvider: WebhookProvider<MonerooWebhookPayload>;
  verifyPayment(paymentId: string): Promise<MonerooVerifiedPayment>;
}

export interface MonerooVerifiedPayment {
  id: string;
  status: string;
  amount: number;
  currency: string;
  metadata: Record<string, string>;
}

export function createMonerooProvider(env: MonerooEnv): MonerooProviderHandle {
  if (!env.MONEROO_SECRET_KEY || !env.MONEROO_WEBHOOK_SECRET) {
    throw new Error(
      'Moneroo provider misconfigured (MONEROO_SECRET_KEY / MONEROO_WEBHOOK_SECRET missing)',
    );
  }
  const apiUrl = (env.MONEROO_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');

  async function charge(input: ChargeInput): Promise<ChargeResult> {
    const { first_name, last_name } = splitCustomerName(input.customer.name, input.customer.email);
    if (!input.customer.email) {
      // Moneroo hard-requires customer.email; fail fast with a clear error
      // instead of an opaque 400 from the API.
      throw new Error('Moneroo charge requires customer.email');
    }

    const body = {
      amount: input.amount,
      currency: input.currency,
      description: `Order ${input.externalRef}`.slice(0, DESCRIPTION_MAX_LEN),
      // Moneroo has no cancel_url — the hosted page redirects back to
      // return_url with ?paymentId=…&paymentStatus=… query params.
      return_url: input.successUrl,
      customer: {
        email: input.customer.email,
        first_name,
        last_name,
        ...(input.customer.phone ? { phone: input.customer.phone } : {}),
      },
      metadata: {
        ...toStringMetadata(input.metadata),
        orderId: input.externalRef,
      },
    };

    const res = await fetch(`${apiUrl}/v1/payments/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.MONEROO_SECRET_KEY}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });

    const json = (await res.json().catch(() => null)) as {
      message?: string;
      data?: { id?: string; checkout_url?: string; status?: string };
    } | null;

    if (!res.ok) {
      throw new Error(
        `Moneroo initialize failed (HTTP ${res.status}): ${json?.message ?? 'unknown error'}`,
      );
    }
    // A 200 without both id + checkout_url is still a failure (reference §
    // "Initialize payment — response shape").
    const id = json?.data?.id;
    const checkoutUrl = json?.data?.checkout_url;
    if (!id || !checkoutUrl) {
      throw new Error('Moneroo initialize returned 200 without data.id/checkout_url');
    }

    return {
      providerChargeId: id,
      paymentUrl: checkoutUrl,
      status: 'PENDING',
    };
  }

  async function verifyPayment(paymentId: string): Promise<MonerooVerifiedPayment> {
    if (!/^[a-zA-Z0-9_-]+$/.test(paymentId)) {
      throw new Error('Invalid Moneroo payment id');
    }
    const res = await fetch(`${apiUrl}/v1/payments/${paymentId}/verify`, {
      headers: {
        Authorization: `Bearer ${env.MONEROO_SECRET_KEY}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      cache: 'no-store',
    });
    const json = (await res.json().catch(() => null)) as {
      message?: string;
      data?: {
        id?: string;
        status?: string;
        amount?: number;
        currency?: string | { code?: string };
        metadata?: Record<string, string>;
      };
    } | null;
    if (!res.ok) {
      throw new Error(
        `Moneroo verify failed (HTTP ${res.status}): ${json?.message ?? 'unknown error'}`,
      );
    }
    const data = json?.data;
    const currency = typeof data?.currency === 'string' ? data.currency : data?.currency?.code;
    if (!data?.id || !data.status || typeof data.amount !== 'number' || !currency) {
      throw new Error('Moneroo verify returned an incomplete payment');
    }
    return {
      id: data.id,
      status: data.status,
      amount: data.amount,
      currency,
      metadata: data.metadata ?? {},
    };
  }

  const webhookProvider: WebhookProvider<MonerooWebhookPayload> = {
    name: 'moneroo',

    verifySignature(rawBody, headers) {
      if (process.env.SMOKE_BYPASS_WEBHOOK_VERIFY === '1') {
        logger.warn(
          '[moneroo] SMOKE_BYPASS_WEBHOOK_VERIFY=1 — webhook signature verification BYPASSED. DEV ONLY.',
        );
        return { valid: true };
      }
      const sig = headers['x-moneroo-signature'];
      if (!sig) return { valid: false, reason: 'Missing x-moneroo-signature header' };
      const expected = crypto
        .createHmac('sha256', env.MONEROO_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');
      if (!timingSafeStringEqual(sig.trim(), expected)) {
        return { valid: false, reason: 'HMAC mismatch' };
      }
      return { valid: true };
    },

    parsePayload(rawBody) {
      return JSON.parse(rawBody.toString('utf-8')) as MonerooWebhookPayload;
    },

    extractIds(payload) {
      const externalId = String(payload.data?.id ?? '');
      const eventType = String(payload.event ?? 'unknown');
      return {
        externalId,
        eventType,
        kind: classifyEvent(payload.event, payload.data?.status),
      };
    },
  };

  return {
    name: 'moneroo',
    charge,
    verifyPayment,
    webhookProvider,
  };
}
