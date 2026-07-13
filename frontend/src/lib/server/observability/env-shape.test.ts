import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ENV_EXAMPLE = resolve(__dirname, '../../../../../.env.example');

describe('.env.example self-hosted production shape', () => {
  const src = readFileSync(ENV_EXAMPLE, 'utf8');

  it(`declares an active self-hosted Supabase DATABASE_URL (file: ${ENV_EXAMPLE})`, () => {
    // The active (uncommented) line defaults to the self-host Supabase pooler.
    // Neon is offered as an alternative in the surrounding comments (Option A).
    expect(src).toMatch(
      /^DATABASE_URL="postgresql:\/\/postgres\.[^:]+:[^@]+@supabase-pooler:5432\/postgres/m,
    );
  });

  it('documents Neon as an alternative DB option', () => {
    expect(src.toLowerCase()).toContain('neon');
  });

  it('uses session pooling with bounded Prisma connections', () => {
    const match = src.match(/^DATABASE_URL="([^"]+)"/m);
    expect(match, `DATABASE_URL line not found in ${ENV_EXAMPLE}`).not.toBeNull();
    expect(match![1]).toContain('connection_limit=5');
    expect(match![1]).toContain('pool_timeout=15');
  });

  it('declares DIRECT_URL and explains migrations', () => {
    expect(src).toMatch(/^DIRECT_URL="postgresql:\/\/[^"]+"/m);
    expect(src.toLowerCase()).toContain('migrate deploy');
  });

  it('declares CRON_SECRET with an openssl hint', () => {
    expect(src).toMatch(/^CRON_SECRET=""/m);
    expect(src).toContain('openssl rand -base64 32');
  });

  it('declares self-hosted platform and provider variables without Bictorys', () => {
    for (const key of [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'MONEROO_SECRET_KEY',
      'MONEROO_WEBHOOK_SECRET',
      'CLOUDFLARE_API_TOKEN',
      'UPSTASH_REDIS_REST_URL',
      'RESEND_API_KEY',
      'GOOGLE_CLIENT_ID',
      'STRIPE_SECRET_KEY',
    ]) {
      expect(src).toMatch(new RegExp(`^${key}=`, 'm'));
    }
    expect(src).not.toContain('BICTORYS_');
  });
});

describe('.env.example upload and withdrawal safety knobs', () => {
  const src = readFileSync(ENV_EXAMPLE, 'utf8');

  it('contains the financial-safety warning', () => {
    expect(src).toContain('⚠️  FINANCIAL-SAFETY WARNING — DO NOT CASUALLY DISABLE  ⚠️');
    expect(src).toContain('WITHDRAWAL_BALANCE_CHECK="1"');
  });

  it('declares upload limits and Cloudinary keys', () => {
    expect(src).toContain('UPLOAD_ALLOWED_MIME="image/jpeg,image/png,image/webp"');
    expect(src).toContain('UPLOAD_MAX_BYTES="10485760"');
    expect(src).toMatch(/^CLOUDINARY_CLOUD_NAME=""$/m);
    expect(src).toMatch(/^CLOUDINARY_API_KEY=""$/m);
    expect(src).toMatch(/^CLOUDINARY_API_SECRET=""$/m);
  });

  it('declares production-safe withdrawal defaults', () => {
    expect(src).toContain('WITHDRAWAL_MIN_AMOUNT="1000"');
    expect(src).toContain('WITHDRAWAL_REQUIRE_PIN="1"');
  });
});

describe('.env.example retention and expiration knobs', () => {
  const src = readFileSync(ENV_EXAMPLE, 'utf8');

  it('contains retention and expiration defaults', () => {
    expect(src).toContain('WEBHOOK_LOG_RETENTION_DAYS="90"');
    expect(src).toContain('ORDER_EXPIRATION_MINUTES="30"');
  });
});
