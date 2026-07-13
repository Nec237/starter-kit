import crypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMonerooProvider, splitCustomerName, toStringMetadata } from './moneroo';

afterEach(() => vi.restoreAllMocks());

describe('Moneroo provider', () => {
  it('normalizes customer names and metadata', () => {
    expect(splitCustomerName('Ada Lovelace', 'ada@example.com')).toEqual({
      first_name: 'Ada',
      last_name: 'Lovelace',
    });
    expect(splitCustomerName(undefined, 'ada@example.com')).toEqual({
      first_name: 'ada',
      last_name: '-',
    });
    expect(toStringMetadata({ count: 2, empty: null })).toEqual({ count: '2' });
  });

  it('initializes hosted checkout and verifies a payment', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { id: 'pay_1', checkout_url: 'https://checkout.moneroo.io/pay_1' },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: 'pay_1',
              status: 'success',
              amount: 1000,
              currency: { code: 'XOF' },
              metadata: { orderId: 'o1' },
            },
          }),
          { status: 200 },
        ),
      );
    const provider = createMonerooProvider({
      MONEROO_SECRET_KEY: 'secret',
      MONEROO_WEBHOOK_SECRET: 'webhook',
    });
    const charge = await provider.charge({
      amount: 1000,
      currency: 'XOF',
      customer: { email: 'ada@example.com' },
      successUrl: 'https://monsplit.com/success',
      failureUrl: 'https://monsplit.com/failed',
      externalRef: 'o1',
    });
    expect(charge.providerChargeId).toBe('pay_1');
    await expect(provider.verifyPayment('pay_1')).resolves.toEqual(
      expect.objectContaining({ id: 'pay_1', status: 'success', amount: 1000, currency: 'XOF' }),
    );
  });

  it('verifies raw-body webhook HMAC', () => {
    const provider = createMonerooProvider({
      MONEROO_SECRET_KEY: 'secret',
      MONEROO_WEBHOOK_SECRET: 'webhook',
    });
    const body = Buffer.from('{"event":"payment.success"}');
    const signature = crypto.createHmac('sha256', 'webhook').update(body).digest('hex');
    expect(
      provider.webhookProvider.verifySignature(body, { 'x-moneroo-signature': signature }),
    ).toEqual({ valid: true });
  });
});
