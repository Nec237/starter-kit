import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import type { MonerooWebhookPayload } from '@/lib/server/payments/moneroo';

export function monerooFixture(
  options: {
    event?: string;
    status?: string;
    paymentId?: string;
    webhookSecret?: string;
  } = {},
): {
  rawBody: Buffer;
  headers: Record<string, string>;
  payload: MonerooWebhookPayload;
} {
  const payload: MonerooWebhookPayload = {
    event: options.event ?? 'payment.success',
    data: {
      id: options.paymentId ?? 'payment_test_001',
      status: options.status ?? 'success',
      amount: 1000,
      currency: 'XOF',
      metadata: { orderId: 'order_test_001' },
    },
  };
  const rawBody = Buffer.from(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', options.webhookSecret ?? 'test-webhook-secret')
    .update(rawBody)
    .digest('hex');
  return {
    rawBody,
    headers: {
      'content-type': 'application/json',
      'x-moneroo-signature': signature,
    },
    payload,
  };
}

export function monerooFixtureRequest(options: Parameters<typeof monerooFixture>[0] = {}) {
  const fixture = monerooFixture(options);
  return {
    ...fixture,
    req: new NextRequest('http://localhost/api/webhooks/moneroo', {
      method: 'POST',
      headers: fixture.headers,
      body: fixture.rawBody as unknown as BodyInit,
    }),
  };
}
