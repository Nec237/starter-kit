FROM node:20-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json frontend/package.json
COPY frontend/prisma frontend/prisma
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY frontend frontend
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
  JWT_SECRET=build-only-placeholder-jwt-secret-000000000000 \
  ENCRYPTION_KEY=build-only-placeholder-encryption-key-000000000000 \
  CRON_SECRET=build-only-placeholder-cron-secret \
  NEXT_PUBLIC_COOKIE_PREFIX=monsplit \
  pnpm --filter frontend build

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["sh", "-c", "pnpm --filter frontend db:migrate:deploy && pnpm --filter frontend start"]
