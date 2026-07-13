import 'server-only';
import type { WebhookProvider } from './handler';
import {
  createMonerooProvider,
  type MonerooProviderHandle,
  type MonerooWebhookPayload,
} from '../payments/moneroo';

export type { MonerooWebhookPayload };

let provider: MonerooProviderHandle | null = null;

export function getMonerooPaymentProvider(): MonerooProviderHandle {
  if (provider) return provider;
  const secretKey = process.env.MONEROO_SECRET_KEY ?? '';
  const webhookSecret = process.env.MONEROO_WEBHOOK_SECRET ?? '';
  if (!secretKey || !webhookSecret) {
    throw new Error('Moneroo webhook provider not configured (env missing)');
  }
  provider = createMonerooProvider({
    MONEROO_SECRET_KEY: secretKey,
    MONEROO_WEBHOOK_SECRET: webhookSecret,
    ...(process.env.MONEROO_API_URL ? { MONEROO_API_URL: process.env.MONEROO_API_URL } : {}),
  });
  return provider;
}

export function getMonerooWebhookProvider(): WebhookProvider<MonerooWebhookPayload> {
  return getMonerooPaymentProvider().webhookProvider;
}

export const monerooWebhookProvider: WebhookProvider<MonerooWebhookPayload> = {
  name: 'moneroo',
  verifySignature: (raw, headers) => getMonerooWebhookProvider().verifySignature(raw, headers),
  parsePayload: (raw) => getMonerooWebhookProvider().parsePayload(raw),
  extractIds: (payload) => getMonerooWebhookProvider().extractIds(payload),
};

export function __resetMonerooWebhookProvider(): void {
  provider = null;
}
