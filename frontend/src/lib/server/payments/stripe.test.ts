import crypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createStripeProvider,
  parseStripeSignature,
  toStringMetadata,
  toStripeForm,
} from './stripe';

afterEach(() => vi.restoreAllMocks());

describe('Stripe provider', () => {
  it('throws when misconfigured (inert without keys)', () => {
    expect(() =>
      createStripeProvider({ STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '' }),
    ).toThrow(/misconfigured/);
  });

  it('flattens nested params into Stripe bracket form-encoding', () => {
    const form = toStripeForm({
      mode: 'payment',
      line_items: { '0': { quantity: 1, price_data: { unit_amount: 1000 } } },
      metadata: { orderId: 'o1', empty: null },
    });
    expect(form.get('mode')).toBe('payment');
    expect(form.get('line_items[0][quantity]')).toBe('1');
    expect(form.get('line_items[0][price_data][unit_amount]')).toBe('1000');
    expect(form.get('metadata[orderId]')).toBe('o1');
    expect(form.has('metadata[empty]')).toBe(false);
  });

  it('normalizes metadata to strings', () => {
    expect(toStringMetadata({ count: 2, empty: null, name: 'x' })).toEqual({
      count: '2',
      name: 'x',
    });
  });

  it('parses the Stripe-Signature header', () => {
    expect(parseStripeSignature('t=123,v1=abc')).toEqual({ timestamp: '123', v1: 'abc' });
    expect(parseStripeSignature('garbage')).toBeNull();
    expect(parseStripeSignature(undefined)).toBeNull();
  });

  it('opens a hosted Checkout Session', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'cs_1', url: 'https://checkout.stripe.com/c/cs_1' }), {
        status: 200,
      }),
    );
    const provider = createStripeProvider({
      STRIPE_SECRET_KEY: 'sk_test_1',
      STRIPE_WEBHOOK_SECRET: 'whsec_1',
    });
    const charge = await provider.charge({
      amount: 1000,
      currency: 'XOF',
      customer: { email: 'ada@example.com' },
      successUrl: 'https://example.com/success',
      failureUrl: 'https://example.com/failed',
      externalRef: 'o1',
    });
    expect(charge).toEqual({
      providerChargeId: 'cs_1',
      paymentUrl: 'https://checkout.stripe.com/c/cs_1',
      status: 'PENDING',
    });
  });

  it('verifies a raw-body webhook signature with timestamp tolerance', () => {
    const provider = createStripeProvider({
      STRIPE_SECRET_KEY: 'sk_test_1',
      STRIPE_WEBHOOK_SECRET: 'whsec_1',
    });
    const body = Buffer.from('{"type":"checkout.session.completed"}');
    const timestamp = String(Math.floor(Date.now() / 1000));
    const expected = crypto
      .createHmac('sha256', 'whsec_1')
      .update(`${timestamp}.${body.toString('utf-8')}`)
      .digest('hex');
    expect(
      provider.webhookProvider.verifySignature(body, {
        'stripe-signature': `t=${timestamp},v1=${expected}`,
      }),
    ).toEqual({ valid: true });
  });

  it('rejects a tampered or stale signature', () => {
    const provider = createStripeProvider({
      STRIPE_SECRET_KEY: 'sk_test_1',
      STRIPE_WEBHOOK_SECRET: 'whsec_1',
    });
    const body = Buffer.from('{"type":"checkout.session.completed"}');
    const now = String(Math.floor(Date.now() / 1000));
    expect(
      provider.webhookProvider.verifySignature(body, {
        'stripe-signature': `t=${now},v1=deadbeef`,
      }).valid,
    ).toBe(false);
    // stale timestamp (2h old) → rejected even with a correct-shaped sig
    const stale = String(Math.floor(Date.now() / 1000) - 7200);
    expect(
      provider.webhookProvider.verifySignature(body, {
        'stripe-signature': `t=${stale},v1=deadbeef`,
      }).valid,
    ).toBe(false);
  });

  it('classifies webhook event kinds', () => {
    const provider = createStripeProvider({
      STRIPE_SECRET_KEY: 'sk_test_1',
      STRIPE_WEBHOOK_SECRET: 'whsec_1',
    });
    const ids = provider.webhookProvider.extractIds({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', metadata: { orderId: 'o1' } } },
    });
    expect(ids).toEqual({
      externalId: 'cs_1',
      eventType: 'checkout.session.completed',
      kind: 'paid',
    });
  });
});
