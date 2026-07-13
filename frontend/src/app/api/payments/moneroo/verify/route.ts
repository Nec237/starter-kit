export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyCsrf } from '@/lib/server/auth';
import { requireAuth } from '@/lib/server/middleware';
import { enqueueOutbox } from '@/lib/server/outbox';
import {
  getProvider,
  PaymentProviderUnconfiguredError,
} from '@/lib/server/payments/provider-singleton';
import { prisma } from '@/lib/server/prisma';

const Body = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().min(1).max(200),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const csrfFail = verifyCsrf(req);
  if (csrfFail) return csrfFail;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { id: parsed.data.orderId, userId: auth.user.sub, provider: 'moneroo' },
  });
  if (!order) return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 });
  if (order.providerChargeId !== parsed.data.paymentId) {
    return NextResponse.json({ error: 'PAYMENT_MISMATCH' }, { status: 409 });
  }

  let payment;
  try {
    payment = await getProvider().verifyPayment(parsed.data.paymentId);
  } catch (error) {
    if (error instanceof PaymentProviderUnconfiguredError) {
      return NextResponse.json({ error: 'PAYMENT_PROVIDER_UNCONFIGURED' }, { status: 503 });
    }
    return NextResponse.json({ error: 'PAYMENT_VERIFICATION_FAILED' }, { status: 502 });
  }

  const successful = ['success', 'succeeded', 'paid'].includes(payment.status.toLowerCase());
  const reference = payment.metadata.orderId ?? payment.metadata.order_id;
  if (
    payment.id !== order.providerChargeId ||
    payment.currency.toUpperCase() !== order.currency.toUpperCase() ||
    payment.amount < order.amount ||
    (reference && reference !== order.id)
  ) {
    return NextResponse.json({ error: 'PAYMENT_MISMATCH' }, { status: 409 });
  }
  if (!successful) {
    return NextResponse.json({ id: order.id, status: order.status }, { status: 202 });
  }

  if (order.status !== 'PAID') {
    await prisma.$transaction(async (tx) => {
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
    });
  }

  return NextResponse.json({ id: order.id, status: 'PAID' });
}
