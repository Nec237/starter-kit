---
name: setup-kit
description: Use when the user wants to bootstrap their dev environment for this "Starter Kit" (Next.js 16 headless starter) from zero. Triggers — "/setup-kit", "je viens d'installer Claude Code", "je débute", "qu'est-ce que je dois installer", "setup my environment", "I just cloned the repo, what now?", "help me start", "I'm a beginner". The kit needs one Postgres database and offers TWO guided paths — **Neon** (cloud, zéro install, recommandé débutant) or **self-hosted Supabase** (Docker stack, recommandé développeur expérimenté, with a Cloudflare domain guide). The skill audits Claude Code (CLI or VS Code/Cursor/Windsurf/Antigravity extension) / Git / Node / pnpm / gh CLI / env vars, blocks ZIP-download cases (no .git dir), **auto-installs the superpowers + context-mode plugins via the `claude plugin` CLI** (context-mode = cross-LLM agent memory, compatible Claude Code / Codex / OpenCode), plugs the DB connection strings into frontend/.env.local, generates secrets, applies Prisma migrations, and — once everything is green — **runs a final brainstorming/writing-plans phase** that interrogates the user about THEIR project and produces a detailed plan before implementation. Payments default to Moneroo (principal) with Stripe as a pluggable alternative. Banani is OPTIONAL. No Vercel CLI required — deploys happen via GitHub push. Beginner-friendly — assumes zero prior knowledge, explains each step, stops at every human gate. The pitch is **vibe coding**: fork the template, plug a DB, talk to Claude, ship.
---

# Skill — setup-kit

## Purpose

Take a brand-new user from **« Claude Code just installed, template just forked »** to **« `pnpm dev` boots green, `pnpm smoke:auth` passes, and my project is planned »** in 10-15 minutes, with maximum hand-holding and minimum hidden assumptions.

The only mandatory dependency is a Postgres database, and the kit gives the user a **choice**:

- **Neon** — cloud, zéro install, **recommandé débutant**. The webhook handler offloads side-effects to the outbox to fit Neon's 2s transaction ceiling, and `/forgot-password` calibrates its timing-attack floor at 350ms for Neon-pooler latency.
- **Self-hosted Supabase** — Docker stack (PostgreSQL + Supavisor + Auth + Storage + Studio), **recommandé développeur expérimenté**, avec un guide Cloudflare pour le domaine.

The optional providers (Upstash / Resend / Cloudinary / Moneroo / Stripe / Google OAuth / Sentry) are env-gated and inert when absent. Two Claude Code plugins — **superpowers** (brainstorming, writing-plans, TDD, systematic-debugging) and **context-mode** (persistent cross-LLM agent memory) — are **installed automatically by the skill** via the `claude plugin` CLI. `ui-ux-pro-max` is bundled in the repo.

> **Not a magic button.** Several steps require human action (creating a DB account, buying/configuring a domain for self-host, copying API keys, restarting Claude Code to load plugins) — the AI cannot do them. The skill makes these gates **explicit, sequential, and unmissable**, instead of letting a beginner discover them via cryptic build errors.

## When to invoke

- User typed `/setup-kit`
- User said any of: « je viens d'installer Claude Code », « je débute », « par où je commence », « qu'est-ce que je dois installer », « I'm a beginner », « help me set up », « I just cloned, what now? »
- The user is clearly lost about pre-requisites (asks « comment lancer le projet ? » with no `node_modules/` and no `.env.local`)

## Beginner Mode — non-negotiable

When this skill is active, you MUST:

1. **Explain every command** before running it (1 line, plain language, no jargon — « pnpm » mérite une phrase, « env var » aussi).
2. **Stop at every human gate** — never silently skip. Print a numbered TODO with URLs the user clicks.
3. **Use French by default** (the kit was authored by a French speaker; switch to English only if the user replies in English).
4. **Never assume prior dev knowledge.**
5. **Verify after each phase** — re-run the relevant check; never proceed on faith.
6. **Maintain a TodoWrite list** with one item per phase. Mark items completed as you go.
7. **Be resumable** — the user may close Claude Code mid-flow. On re-invocation, run the audit first; pick up where it broke.

## Procedure

### Phase 0 — Audit

Run these probes via Bash **in parallel** and build a table.

| Check | Command | Pass criterion |
|---|---|---|
| Claude Code CLI | `claude --version 2>/dev/null \|\| echo MISSING` | semver string (informational — most users run the VS Code extension instead) |
| Git installed | `git --version 2>/dev/null \|\| echo MISSING` | semver string (hard blocker — without Git the user can't push their work) |
| **Repo is a git clone** (not ZIP) | `test -d .git && echo REPO \|\| echo NOT-A-REPO` | REPO (NOT-A-REPO = user downloaded the ZIP from GitHub instead of using the template → can't push later; hard blocker) |
| Node version | `node -v 2>/dev/null \|\| echo MISSING` | starts with `v20.` or higher |
| pnpm version | `pnpm -v 2>/dev/null \|\| echo MISSING` | starts with `9.` or higher |
| GitHub CLI auth | `gh auth status 2>&1 \| head -1` | « Logged in to github.com » present |
| superpowers plugin | `claude plugin list 2>/dev/null \| grep -qi superpowers && echo OK \|\| echo MISSING` | OK (else auto-install in Phase 2) |
| context-mode plugin | `claude plugin list 2>/dev/null \| grep -qi context-mode && echo OK \|\| echo MISSING` | OK (else auto-install in Phase 2) |
| Repo env file | `(test -f frontend/.env.local && echo EXISTS_LOCAL) \|\| (test -f frontend/.env && echo EXISTS_ENV) \|\| echo MISSING` | EXISTS_LOCAL preferred, EXISTS_ENV also accepted |
| Repo `node_modules` | `test -d frontend/node_modules && echo EXISTS \|\| echo MISSING` | EXISTS |
| MCP config | `test -f .mcp.json && echo EXISTS \|\| echo MISSING` | EXISTS |
| `DATABASE_URL` set | `cat frontend/.env.local frontend/.env 2>/dev/null \| grep -Eq '^DATABASE_URL="?postgresql://' && echo SET \|\| echo UNSET` | SET (Neon or self-hosted Supabase — see Phase 3) |

Print the result as a checklist:

```
🔍 AUDIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SYSTÈME
  ℹ️  Claude Code CLI (extension VS Code OK aussi)
  ✅ Git installé    ✅ Repo cloné (.git présent)
  ✅ Node 20.x       ❌ pnpm (manquant)
  ⏳ gh CLI (pas authentifié)
  ✅ .mcp.json présent

PLUGINS CLAUDE CODE (auto-installés en Phase 2)
  ❌ superpowers     ❌ context-mode
  ✅ ui-ux-pro-max (bundlé)

REPO
  ❌ frontend/.env.local manquant
  ❌ frontend/node_modules manquant
  ❌ DATABASE_URL pas défini (Postgres requis)
  ℹ️  Banani MCP (optionnel — Phase 5)

COMPTES (action humaine requise)
  🙋 Postgres — Neon (débutant) OU self-host Supabase (expérimenté)
  🙋 GitHub          ℹ️  Banani (optionnel)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

> **🚨 Blocker NOT-A-REPO** : si la probe « Repo is a git clone » renvoie `NOT-A-REPO`, l'user a téléchargé le ZIP au lieu d'utiliser le template. **Stop la Phase 1** et dis-lui : *« Tu as téléchargé le ZIP — tu ne pourras pas pousser ton travail sur GitHub. Ferme VS Code, supprime ce dossier, puis crée ton projet depuis le template :
> - GitHub : bouton « Use this template » sur la page du repo → crée ton repo → `gh repo clone <toi>/<ton-repo>`
> - ou `gh repo create <ton-repo> --template <owner>/starter-kit --clone`
> Puis relance Claude Code dans le nouveau dossier et tape `/setup-kit`. »*

### Phase 1 — Outils système

For each MISSING item, take the action below. **NEVER skip a missing one silently.**

| Manquant | Action AI | Action humaine |
|---|---|---|
| **Claude Code (CLI absent)** | — | « Si tu lis ceci, Claude Code tourne déjà — extension VS Code / Cursor / Windsurf / Antigravity, ou CLI. La CLI est optionnelle : `npm install -g @anthropic-ai/claude-code` (Node 20+). » |
| **Git absent** | macOS : `brew install git` après confirmation. Linux : `sudo apt install git`. Windows : `winget install Git.Git`. | Sans Git, pas de clone/push/commit — Stop. |
| **NOT-A-REPO** (ZIP) | — | « Recrée le projet depuis le template (« Use this template » sur GitHub, ou `gh repo create <ton-repo> --template <owner>/starter-kit --clone`). Relance `/setup-kit`. » Stop. |
| **Node < 20** | — | « https://nodejs.org/en/download → LTS (≥ 20). Relance `/setup-kit`. » Stop. |
| **pnpm** | `corepack enable && corepack prepare pnpm@latest --activate` | Aucune. Windows PowerShell si `running scripts is disabled` : `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` puis relance Corepack. |
| **gh CLI** | macOS : `brew install gh`. Sinon https://cli.github.com/ | `gh auth login` — interactif : « GitHub.com » → « HTTPS » → navigateur. |

> **Pas de Vercel CLI requise.** Déploiement via GitHub push (Vercel importe le repo) ou Docker/Dokploy pour le self-host.

After each install, **re-run the matching probe**. If install fails, don't proceed — explique en français simple et propose **une seule** alternative.

### Phase 2 — Auto-install des plugins (superpowers + context-mode)

`ui-ux-pro-max` est **déjà bundlé** dans le repo — rien à faire. Il reste 2 plugins externes, que **l'IA installe automatiquement via la CLI `claude plugin`** (non-interactif). Explique à l'user : *« superpowers = brainstorming, plans, TDD, debug systématique. context-mode = la mémoire persistante de l'agent (aucun contexte oublié, même après reset). »*

**Méthode auto (défaut — l'IA lance ces commandes via Bash)** :

```bash
claude plugin marketplace add obra/superpowers-marketplace
claude plugin install superpowers@superpowers-marketplace
claude plugin marketplace add mksglu/context-mode
claude plugin install context-mode@context-mode
```

Vérifie ensuite : `claude plugin list | grep -Ei 'superpowers|context-mode'` (les 2 doivent apparaître `enabled`).

**Fallback UI** (si la CLI échoue — pas de binaire `claude` dans le PATH, ex. extension VS Code sans CLI) : demande à l'user de taper dans le chat Claude :

```
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
/plugin marketplace add mksglu/context-mode
/plugin install context-mode@context-mode
```

Puis, dans les 2 cas : « **Redémarre Claude Code** pour charger les plugins, puis relance `/setup-kit` pour vérifier.
> - Extension VS Code / Antigravity : `Cmd+Shift+P` / `Ctrl+Shift+P` → `Developer: Reload Window`.
> - CLI : `Ctrl+C` puis relance `claude`. »

> **GSD intentionnellement omis.** Workflow procédural lourd, utile quand le projet grossit. Surface-le plus tard, pas au bootstrap.

### Phase 2bis — Mémoire agent cross-LLM (MCP context-mode)

context-mode donne à l'agent une **mémoire persistante du projet** — décisions, erreurs, plans, prompts sont indexés et re-cherchables. Il est **cross-LLM** : le même serveur MCP marche pour Claude Code, Codex, OpenCode, Cursor, Antigravity, Copilot.

- **Claude Code** : déjà couvert par le plugin installé en Phase 2 (l'MCP `context-mode` s'active au redémarrage).
- **Autres agents (Codex / OpenCode / Cursor…)** : context-mode fournit des adaptateurs dédiés. Le serveur MCP se lance via `node start.mjs` avec la variable `CONTEXT_MODE_PLATFORM=<agent>` (ex. `codex`, `opencode`). Pour l'installer sur un agent non-Claude, pointe l'user vers le marketplace `mksglu/context-mode` et l'adaptateur correspondant (`.codex-plugin/mcp.json`, adaptateur opencode, etc.). But : **quel que soit le LLM que tu utilises sur ce projet plus tard, il garde la mémoire — aucun code oublié.**

Explique que c'est ce qui permet de reprendre le projet sur n'importe quel agent sans tout ré-expliquer. Vérifie côté Claude Code que l'outil `ctx_stats` répond après redémarrage (optionnel).

### Phase 3 — Base de données (2 options, l'user choisit)

Une seule dépendance obligatoire : Postgres. **Présente les 2 options et laisse l'user choisir. Quel que soit son choix, guide-le jusqu'au bout.**

> **« Débutant → Neon (Option A). Développeur expérimenté → self-host Supabase (Option B). Tu choisis, je te guide. »**

#### Option A — Neon (RECOMMANDÉ DÉBUTANT)

Cloud, zéro install, 30 secondes.

1. **Inscription** — « Va sur https://neon.tech, inscription gratuite (Google / GitHub). Confirme quand c'est fait. »
2. **Création projet** — « Dashboard Neon → "New Project", nomme-le, région la plus proche. Confirme. »
3. **Copier les 2 URLs** — « Dans le dashboard :
   - `DATABASE_URL` = la version avec **`-pooler`** dans le hostname (pour l'app)
   - `DIRECT_URL` = la version **SANS** `-pooler` (pour `prisma migrate`)
   - Colle-les ici, je les écris dans `.env.local`. »
4. **AI écrit `.env.local`** — `cp .env.example frontend/.env.local` puis `Edit` pour insérer les 2 URLs. Laisse `SUPABASE_URL` vide (non utilisé avec Neon).

> Timing floor `/forgot-password` : 350ms par défaut, calibré Neon-pooler. Override `AUTH_FORGOT_TARGET_LATENCY_MS` si ta DB est plus lente.

#### Option B — Self-hosted Supabase (RECOMMANDÉ EXPÉRIMENTÉ)

Plus sophistiqué, mais le kit t'aide. Stack Docker : PostgreSQL + Supavisor (pooler) + Auth + PostgREST + Storage + Realtime + Studio.

**Étape 1 — Domaine.**
- **Si l'user a DÉJÀ un domaine** → on installe la stack self-host directement sur ce domaine.
- **Sinon** → guide l'achat d'un domaine (Namecheap / Cloudflare Registrar / OVH…), puis la config Cloudflare ci-dessous.

**Étape 2 — Cloudflare (DNS + gestion du domaine).** Explique chaque variable et où la trouver :
1. « Crée un compte gratuit sur https://cloudflare.com, ajoute ton domaine (Add a site), suis les instructions pour pointer les nameservers du registrar vers Cloudflare. »
2. Récupère les variables (elles vont dans `.env.local`) :
   - `CLOUDFLARE_ACCOUNT_ID` — dashboard Cloudflare → sidebar, ou page d'accueil du compte.
   - `CLOUDFLARE_ZONE_ID` — page **Overview** du domaine, colonne de droite « API », « Zone ID ».
   - `CLOUDFLARE_API_TOKEN` — **My Profile → API Tokens → Create Token** (permissions Zone:DNS:Edit sur ta zone). Copie-le **une seule fois**.
3. « Crée un enregistrement DNS **A** (ou CNAME) qui pointe `supabase.<ton-domaine>` (et la racine si besoin) vers l'IP publique de ton serveur. Active le proxy Cloudflare (nuage orange) pour le HTTPS automatique. »

**Étape 3 — Lancer la stack Docker + remplir `.env.local`.** Une fois la stack Supabase Docker déployée sur le serveur/domaine, récupère et écris :
- `DATABASE_URL` = URL du pool Supavisor (session), forme `postgresql://postgres.TENANT:PASSWORD@<host-pooler>:5432/postgres?connection_limit=5&pool_timeout=15`
- `DIRECT_URL` = service DB direct (sans pooler)
- `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` = `https://supabase.<ton-domaine>`
- `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` = clés générées par la stack

Toujours via `Edit` ligne par ligne (jamais réécrire `.env.local` en entier).

### Phase 4 — Install du repo + secrets

Séquentiel :

1. **Install** — `pnpm install` (« télécharge les librairies, ~2 min la 1re fois »).
2. **Secrets** — pour `JWT_SECRET` / `ENCRYPTION_KEY` / `CRON_SECRET`, lance `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` une fois par clé, puis `Edit` dans `.env.local`.
3. **Migrations** — `pnpm db:migrate:deploy` (« crée les tables dans ta DB »). Vérifie que ça finit sans erreur.

Stop si une étape échoue. Explique en français, propose un fix.

### Phase 5 — Banani MCP (optionnel — design import)

**Demande :** *« Tu as un design Banani ? oui / non / plus tard »*

- **non / plus tard** → Skip. *« Pas de souci — tu décriras tes écrans à Claude en français à la fin, il construira l'UI. »* Passe à Phase 6.
- **oui** → https://banani.co (gratuit). Demande ce que Banani a donné (commande / URL / bloc JSON) :
  - **Commande `claude mcp add ...`** (user-scope, écrit dans `~/.claude.json`) → **ne la lance PAS toi-même** (token sensible). Demande à l'user de la lancer dans un terminal, puis `claude mcp list`.
  - **Bloc JSON / URL pure** (project-scope) → l'IA met à jour `.mcp.json`. **Jamais** de Bearer token en clair dans `.mcp.json` (committé) — route les tokens vers la commande `claude mcp add`.
  - Puis : redémarre Claude Code ; au prochain chat, « reproduis ces écrans-là » → le skill `banani-design-implementation` prend le relais.

### Phase 6 — Comptes optionnels (skip-friendly)

Pour chaque : « Tu veux activer [feature] maintenant ? oui / non / plus tard ». Skip sans jugement — le kit boote sans.

| Feature | Provider | URL | Clés à coller |
|---|---|---|---|
| Cache / rate-limit | Upstash Redis | https://upstash.com | `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` |
| Emails transactionnels | Resend | https://resend.com | `RESEND_API_KEY` + `EMAIL_FROM` |
| Upload fichiers / média | Cloudinary | https://cloudinary.com | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Connexion avec Google | Google Cloud Console | https://console.cloud.google.com/apis/credentials | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| **Paiements — Moneroo (PRINCIPAL)** | Moneroo | https://moneroo.io | `MONEROO_SECRET_KEY` + `MONEROO_WEBHOOK_SECRET` |
| **Paiements — Stripe (ALTERNATIVE)** | Stripe | https://dashboard.stripe.com/apikeys | `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Observabilité | Sentry | https://sentry.io | `SENTRY_DSN` |

- **Google** : ⚠️ le **redirect URI** dans Google Console doit matcher **EXACTEMENT** `GOOGLE_REDIRECT_URI` (ex. `https://ton-domaine.com/api/auth/oauth/google/callback`), sinon la connexion Google échoue. Type d'app : « Web application ».
- **Paiements** : Moneroo est le moyen de paiement **principal** (défaut). Stripe est l'**alternative** pluggable derrière l'interface `PaymentProvider` — active-la avec `PAYMENT_PROVIDER=stripe`. Ne configure qu'un seul des deux sauf besoin explicite.

Pour chaque clé collée, `Edit` `frontend/.env.local` après confirmation. **Jamais** de clé dans le chat visible.

### Phase 7 — Smoke test final

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm test
```

Puis dans un second terminal :

```bash
pnpm dev
```

Puis :

```bash
pnpm smoke:auth
```

**Ne dis jamais « tout est prêt »** tant que ces commandes ne sont pas vertes. Si rouge : stop, colle l'output, explique en français, propose un fix.

### Phase 8 — Planifie TON projet (superpowers brainstorming/writing-plans)

Une fois **tout vert et confirmé installé**, c'est le vrai point de départ du projet de l'user. Invoke la skill **superpowers `brainstorming`** (puis `writing-plans`) pour :

1. **Cuisiner l'user au maximum** sur son projet — poser un max de questions (une à la fois), comprendre le produit, les contraintes, les critères de succès.
2. Écrire un **plan détaillé** (spec + plan d'implémentation).
3. Enchaîner **directement l'implémentation**.

Dis à l'user : *« L'infrastructure est prête (auth, paiements, admin, webhooks, cron, mémoire agent). Maintenant on planifie TON produit : je vais te poser un maximum de questions pour tout comprendre, écrire un plan détaillé, puis on implémente. La mémoire context-mode garde tout le contexte tout du long. »*

Puis : `Skill(superpowers:brainstorming)`. La mémoire context-mode conserve décisions et plan entre les sessions.

## Failure modes — be explicit

| Symptôme | Cause probable | Réponse |
|---|---|---|
| `claude plugin install` échoue (`command not found: claude`) | Pas de CLI Claude dans le PATH (extension VS Code seule) | Bascule sur le fallback UI (slash `/plugin ...` dans le chat) |
| `pnpm install` échoue avec EACCES | Permissions npm cassées | `corepack enable` ; ne **jamais** `sudo` |
| `pnpm db:migrate:deploy` échoue `P1001 connection refused` | `DATABASE_URL` faux ou DB offline | Neon : URL contient `-pooler` ; self-host : stack Docker up + DNS/Cloudflare OK |
| `pnpm db:migrate:deploy` échoue « prepared statement does not exist » | URL pooler mise dans `DIRECT_URL` | `DIRECT_URL` ne doit PAS avoir `-pooler` |
| `pnpm dev` boote mais `/api/auth/signup` renvoie 500 | `JWT_SECRET` / `ENCRYPTION_KEY` manquants ou < 32 chars | Re-run Phase 4 step 2 |
| Connexion Google échoue en boucle | redirect URI Google Console ≠ `GOOGLE_REDIRECT_URI` | Aligner les deux au caractère près |
| User dit « après install de plugin, rien ne change » | Plugin chargé au prochain démarrage | Redémarrer Claude Code (Reload Window / relance `claude`) |

## Anti-patterns — ne fais JAMAIS

- ❌ Lancer `sudo` quoi que ce soit
- ❌ Modifier `~/.zshrc` / `~/.bashrc` sans demander
- ❌ Lancer une commande `claude mcp add` contenant un token Bearer (route vers l'user)
- ❌ Installer Node via Homebrew sur Windows / Linux (utiliser nodejs.org)
- ❌ Cacher les erreurs avec `|| true` (sauf probes Phase 0)
- ❌ Réécrire `.env.local` complet — toujours `Edit` ligne par ligne après lecture
- ❌ Continuer la phase suivante si la précédente est rouge
- ❌ Coller des API keys dans la réponse visible (toujours via Edit dans `.env.local`)
- ❌ Dire « tout est prêt » avant que `format && lint && typecheck && test` soient verts

## Notes pour les forks

Ce skill est bundlé dans le template mais peut diverger par fork :
- Si ton fork retire Moneroo / Stripe / Banani via [PRUNING.md](../../../PRUNING.md), mets à jour la Phase 6.
- Si ton fork ajoute un provider (Paystack, etc.), ajoute-le en Phase 6.
- Le manifeste machine-lisible vit dans [.planning/features.json](../../../.planning/features.json).
