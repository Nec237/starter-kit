import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { monerooFixture, monerooFixtureRequest } from '@/test-utils/moneroo-mock';

const findUnique = vi.fn();
const create = vi.fn();
const update = vi.fn();
const orderFindFirst = vi.fn();
const orderUpdate = vi.fn();
const outboxCreate = vi.fn();
const fetchMock = vi.fn();
const transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
  fn({
    webhookLog: { findUnique, create, update },
    order: { findFirst: orderFindFirst, update: orderUpdate },
    outboxEvent: { create: outboxCreate },
  }),
);

vi.mock('@/lib/server/prisma', () => ({ prisma: { $transaction: transaction } }));

beforeEach(() => {
  vi.stubEnv('MONEROO_SECRET_KEY', 'test-secret-key');
  vi.stubEnv('MONEROO_WEBHOOK_SECRET', 'test-webhook-secret');
  findUnique.mockReset();
  create.mockReset();
  update.mockReset();
  orderFindFirst.mockReset();
  orderUpdate.mockReset();
  outboxCreate.mockReset();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        data: {
          id: 'payment_test_001',
          status: 'success',
          amount: 1000,
          currency: { code: 'XOF' },
          metadata: { orderId: 'order_test_001' },
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('POST /api/webhooks/moneroo', () => {
  it('accepts a valid signed first delivery', async () => {
    findUnique.mockResolvedValueOnce(null);
    orderFindFirst.mockResolvedValueOnce(null);
    const { POST } = await import('./route');
    const res = await POST(monerooFixtureRequest().req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deduped: false });
    expect(create).toHaveBeenCalled();
  });

  it('rejects a tampered body', async () => {
    const fixture = monerooFixture();
    const { NextRequest } = await import('next/server');
    const { POST } = await import('./route');
    const res = await POST(
      new NextRequest('http://localhost/api/webhooks/moneroo', {
        method: 'POST',
        headers: fixture.headers,
        body: Buffer.from(
          fixture.rawBody.toString().replace('success', 'failed'),
        ) as unknown as BodyInit,
      }),
    );
    expect(res.status).toBe(401);
  });

  it('deduplicates a processed delivery', async () => {
    findUnique.mockResolvedValueOnce({ id: 'wl1', processedAt: new Date() });
    const { POST } = await import('./route');
    const res = await POST(monerooFixtureRequest().req);
    expect(await res.json()).toEqual({ ok: true, deduped: true });
  });

  it('rejects a signed webhook when Moneroo verification does not match', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            id: 'payment_test_001',
            status: 'success',
            amount: 999,
            currency: { code: 'XOF' },
            metadata: {},
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const { POST } = await import('./route');
    const res = await POST(monerooFixtureRequest().req);
    expect(res.status).toBe(502);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('marks the matching order paid and enqueues notifications', async () => {
    findUnique.mockResolvedValueOnce(null);
    orderFindFirst.mockResolvedValueOnce({
      id: 'o1',
      userId: 'u1',
      customerEmail: 'a@b.com',
      amount: 1000,
      currency: 'XOF',
    });
    const { POST } = await import('./route');
    await POST(monerooFixtureRequest().req);
    expect(orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PAID' }) }),
    );
    expect(outboxCreate).toHaveBeenCalledTimes(2);
  });

  it('exports the required runtime controls', async () => {
    const route = await import('./route');
    expect(route.runtime).toBe('nodejs');
    expect(route.dynamic).toBe('force-dynamic');
  });
});
