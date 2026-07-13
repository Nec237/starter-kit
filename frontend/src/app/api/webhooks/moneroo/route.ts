export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import 'server-only';
import { createWebhookHandler } from '@/lib/server/webhook/handler';
import { getMonerooPaymentProvider, monerooWebhookProvider } from '@/lib/server/webhook/moneroo';
import { enqueueOutbox } from '@/lib/server/outbox';
import { prisma } from '@/lib/server/prisma';

export const POST = createWebhookHandler({
  prisma,
  provider: monerooWebhookProvider,

  async verifyPayload(payload, ids) {
    if (!ids.externalId) throw new Error('Moneroo webhook is missing data.id');
    const verified = await getMonerooPaymentProvider().verifyPayment(ids.externalId);
    if (verified.id !== ids.externalId) throw new Error('Moneroo payment id mismatch');

    const payloadCurrency =
      typeof payload.data?.currency === 'string'
        ? payload.data.currency
        : payload.data?.currency?.code;
    if (typeof payload.data?.amount === 'number' && verified.amount !== payload.data.amount) {
      throw new Error('Moneroo payment amount mismatch');
    }
    if (payloadCurrency && verified.currency !== payloadCurrency) {
      throw new Error('Moneroo payment currency mismatch');
    }

    const status = verified.status.toLowerCase();
    if (
      ids.kind === 'paid' &&
      !['success', 'successful', 'completed', 'complete', 'paid'].includes(status)
    ) {
      throw new Error(`Moneroo payment is not complete (${verified.status})`);
    }
    if (ids.kind === 'refunded' && !['refund', 'refunded'].includes(status)) {
      throw new Error(`Moneroo payment is not refunded (${verified.status})`);
    }
    if (
      ids.kind === 'failed' &&
      !['failed', 'failure', 'cancelled', 'canceled', 'expired'].includes(status)
    ) {
      throw new Error(`Moneroo payment is not failed (${verified.status})`);
    }
  },

  async onPaid(payload, tx) {
    const paymentId = String(payload.data?.id ?? '');
    if (!paymentId) return {};
    const order = await tx.order.findFirst({ where: { providerChargeId: paymentId } });
    if (!order) return {};

    await tx.order.update({
      where: { id: order.id },
      data: { status: 'PAID', paidAt: new Date() },
    });
    if (order.userId) {
      await enqueueOutbox(tx, {
        kind: 'notification.payment_received',
        payload: {
          userId: order.userId,
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
        },
      });
    }
    if (order.customerEmail) {
      await enqueueOutbox(tx, {
        kind: 'email.payment_confirmation',
        payload: {
          to: order.customerEmail,
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
        },
      });
    }
    return {};
  },

  async onRefunded(payload, tx) {
    const paymentId = String(payload.data?.id ?? '');
    if (!paymentId) return {};
    const order = await tx.order.findFirst({ where: { providerChargeId: paymentId } });
    if (order) {
      await tx.order.update({ where: { id: order.id }, data: { status: 'REFUNDED' } });
    }
    return {};
  },

  async onFailed(payload, tx) {
    const paymentId = String(payload.data?.id ?? '');
    if (!paymentId) return {};
    const order = await tx.order.findFirst({ where: { providerChargeId: paymentId } });
    if (order) {
      await tx.order.update({ where: { id: order.id }, data: { status: 'FAILED' } });
    }
    return {};
  },
});
