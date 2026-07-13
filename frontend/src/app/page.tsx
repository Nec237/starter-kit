// Page d'accueil par défaut du starter « Starter Kit ».
//
// Remplace ce fichier par ta vraie page d'accueil dès que tu es orienté.
// Il existe pour qu'un fork fraîchement cloné affiche quelque chose d'utile à
// `/` plutôt qu'une page blanche — c'est un server component qui lit l'env au
// moment de la requête et montre quels providers optionnels sont configurés.
//
// Design-swappable : n'utilise que des utilitaires Tailwind minimaux ; arrache
// le JSX et écris ta propre page d'accueil. Le starter ne ship aucun composant
// UI, par choix.

export const runtime = 'nodejs';

function ConfigRow({ label, ok, hint }: { label: string; ok: boolean; hint: string }) {
  return (
    <li className="flex flex-wrap items-center gap-2 py-1.5">
      <span aria-hidden className={ok ? 'text-emerald-600' : 'text-amber-500'}>
        {ok ? '✅' : '⚠️ '}
      </span>
      <span className="font-mono text-sm">{label}</span>
      <span className="text-xs text-gray-500">— {hint}</span>
    </li>
  );
}

export default function Home() {
  const env = process.env;

  const required = [
    {
      label: 'DATABASE_URL',
      ok: !!env.DATABASE_URL,
      hint: 'Postgres — Neon ou self-host Supabase',
    },
    { label: 'JWT_SECRET', ok: !!env.JWT_SECRET, hint: 'Clé de signature auth (requise)' },
  ];

  const recommended = [
    { label: 'ENCRYPTION_KEY', ok: !!env.ENCRYPTION_KEY, hint: 'AES-256-GCM (recommandé)' },
    { label: 'CRON_SECRET', ok: !!env.CRON_SECRET, hint: 'Bearer des routes cron (recommandé)' },
    { label: 'DIRECT_URL', ok: !!env.DIRECT_URL, hint: 'Pour prisma migrate deploy' },
  ];

  const optional = [
    {
      label: 'UPSTASH_REDIS_REST_URL',
      ok: !!env.UPSTASH_REDIS_REST_URL,
      hint: 'Redis (rate-limit, file d’attente, verrous)',
    },
    {
      label: 'GOOGLE_CLIENT_ID',
      ok: !!env.GOOGLE_CLIENT_ID,
      hint: 'Connexion avec Google (OAuth)',
    },
    { label: 'RESEND_API_KEY', ok: !!env.RESEND_API_KEY, hint: 'Envoi d’emails' },
    { label: 'EMAIL_FROM', ok: !!env.EMAIL_FROM, hint: 'Adresse expéditrice vérifiée' },
    {
      label: 'CLOUDINARY_CLOUD_NAME',
      ok: !!env.CLOUDINARY_CLOUD_NAME,
      hint: 'Stockage média / uploads (Cloudinary)',
    },
    { label: 'MONEROO_SECRET_KEY', ok: !!env.MONEROO_SECRET_KEY, hint: 'Paiements — principal' },
    { label: 'STRIPE_SECRET_KEY', ok: !!env.STRIPE_SECRET_KEY, hint: 'Paiements — alternative' },
    { label: 'SUPABASE_URL', ok: !!env.SUPABASE_URL, hint: 'API self-host Supabase' },
    { label: 'SENTRY_DSN', ok: !!env.SENTRY_DSN, hint: 'Observabilité (erreurs + traces)' },
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 font-sans text-gray-900">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Starter Kit</h1>
        <p className="mt-2 text-gray-600">
          Starter headless Next.js 16 — auth, paiements, admin, webhooks, cron.
          <br />
          Tu vois cette page par défaut parce que{' '}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
            frontend/src/app/page.tsx
          </code>{' '}
          n&rsquo;a pas encore été remplacé.
        </p>
      </header>

      {/* ─── Débutant : quoi taper ensuite ─────────────────────────────── */}
      <section className="mt-10 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
        <h2 className="text-lg font-semibold text-emerald-900">
          👋 Nouveau ici ? Ouvre ce projet dans Claude Code et tape :
        </h2>
        <pre className="mt-3 overflow-x-auto rounded bg-white p-3 text-sm">/setup-kit</pre>
        <p className="mt-3 text-sm text-emerald-900">
          La skill <code>/setup-kit</code> audite ton environnement, installe les skills{' '}
          <strong>superpowers</strong> et <strong>context-mode</strong> (la mémoire de l&rsquo;agent
          tout au long du projet), configure ta base de données — <strong>au choix : Neon</strong>{' '}
          (recommandé débutant, cloud, zéro install) ou <strong>self-host Supabase</strong>{' '}
          (recommandé développeur expérimenté) — génère les secrets et applique les migrations.
          Ensuite elle <strong>te cuisine sur ton projet</strong> (questions, plan détaillé) avant
          de passer à l&rsquo;implémentation. Les 40 routes API (auth, paiements, admin, webhooks,
          cron, uploads) sont déjà câblées — tu ne parles que de ton produit, pas de la plomberie.
          Voir <code>WORKFLOW.md</code> pour le flow complet.
        </p>
      </section>

      {/* ─── Sondes backend en direct ─────────────────────────────────── */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Statut backend</h2>
        <p className="mt-1 text-sm text-gray-600">
          Sondes JSON en direct — ouvre-les dans un nouvel onglet pour confirmer que tout tourne.
        </p>
        <ul className="mt-3 space-y-1">
          <li>
            <a
              href="/api/health"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline"
            >
              /api/health
            </a>{' '}
            <span className="text-xs text-gray-500">— liveness (répond toujours)</span>
          </li>
          <li>
            <a
              href="/api/readyz"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline"
            >
              /api/readyz
            </a>{' '}
            <span className="text-xs text-gray-500">
              — readiness (sondes DB + Redis, 503 si l&rsquo;un est à terre)
            </span>
          </li>
        </ul>
      </section>

      {/* ─── Configuration des providers ──────────────────────────────── */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Configuration des providers</h2>
        <p className="mt-1 text-sm text-gray-600">
          Lue au moment de la requête depuis <code>process.env</code>. Les providers optionnels sont
          inertes quand absents — les routes correspondantes renvoient 404 en silence et le reste de
          l&rsquo;app continue de fonctionner.
        </p>

        <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Requis (l&rsquo;app refuse de booter sans)
        </h3>
        <ul>
          {required.map((row) => (
            <ConfigRow key={row.label} {...row} />
          ))}
        </ul>

        <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Recommandés (l&rsquo;app boote, mais casse à la première utilisation)
        </h3>
        <ul>
          {recommended.map((row) => (
            <ConfigRow key={row.label} {...row} />
          ))}
        </ul>

        <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Providers optionnels
        </h3>
        <ul>
          {optional.map((row) => (
            <ConfigRow key={row.label} {...row} />
          ))}
        </ul>
      </section>

      {/* ─── Ce que le starter embarque ───────────────────────────────── */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Ce que ce starter embarque</h2>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm">
          <li>
            Routes API sous <code>/api/*</code> — auth, OAuth, admin, paiements, uploads, webhooks,
            5 handlers cron
          </li>
          <li>Schéma Prisma + migrations versionnées (Neon ou self-host Supabase Postgres)</li>
          <li>Suite de tests unitaires Vitest couvrant les libs protégées</li>
          <li>Pipeline CI : format / lint / typecheck / test / build / audit</li>
          <li>
            Mémoire de l&rsquo;agent cross-LLM via le MCP <code>context-mode</code> — compatible
            Claude Code / Codex / OpenCode
          </li>
          <li>Skills superpowers auto-installées (brainstorming, plans, TDD, debugging)</li>
        </ul>
        <p className="mt-3 text-sm text-gray-600">
          Vue d&rsquo;ensemble de l&rsquo;architecture dans{' '}
          <code className="rounded bg-gray-100 px-1.5 py-0.5">CLAUDE.md</code> ; surface publique
          dans <code className="rounded bg-gray-100 px-1.5 py-0.5">README.md</code>.
        </p>
      </section>

      <footer className="mt-12 border-t border-gray-200 pt-6 text-xs text-gray-500">
        Remplace cette page dans{' '}
        <code className="rounded bg-gray-100 px-1.5 py-0.5">frontend/src/app/page.tsx</code> quand
        tu es prêt.
      </footer>
    </main>
  );
}
