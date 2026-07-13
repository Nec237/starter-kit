# Starter Kit — Noyau réutilisable (design)

Date : 2026-07-13
Statut : approuvé (implémentation en cours)

## Objectif

Transformer le starter actuel (« izi kit ») en un **noyau réutilisable « Starter Kit »** :
un template GitHub que l'utilisateur forke à chaque nouveau projet pour repartir d'une
base déjà câblée (auth, paiements, admin, webhooks, cron, mémoire agent, skills), sans
jamais refaire l'installation. La dernière étape du kit cuisine l'utilisateur sur SON
projet (brainstorming/writing-plans) puis enchaîne l'implémentation.

## Décisions figées

- **Nom** : `izi kit` / `izikit` → **Starter Kit** (repo `starter-kit`).
- **Langue** : contenu utilisateur (homepage, guide, étapes setup-kit) 100 % français.
- **DB** : deux options guidées, l'utilisateur choisit dans setup-kit —
  - **Neon** — recommandé débutant (cloud, zéro install).
  - **Self-host Supabase (Docker)** — recommandé développeur expérimenté, avec guide
    Cloudflare (domaine + DNS + env vars) ; si domaine déjà acheté, install direct dessus.
  - Peu importe le choix, setup-kit guide jusqu'au bout.
- **Paiements** : Moneroo = principal (déjà implémenté). Stripe = alternative documentée +
  stub provider derrière l'interface `PaymentProvider` (inerte sans clés).
- **Skills auto-install** : setup-kit installe superpowers + context-mode via `claude plugin`
  (CLI non-interactif), fallback UI si échec.
- **Mémoire agent cross-LLM** : MCP context-mode installé + configuré ; compatible Claude
  Code / Codex / OpenCode (adaptateurs fournis par context-mode). Commande d'install
  documentée par agent.
- **Phase finale du kit** = brainstorming/writing-plans (superpowers) : max de questions
  sur le projet → plan détaillé → implémentation.
- **Ordre de push** : tout construire + confirmer vert AVANT tout push. Puis deux pushes :
  1. nouveau repo public `starter-kit` marqué template ;
  2. repo actuel MonSplit.
- Secrets : `.env.local` déjà gitignored → template propre, aucune info perso poussée.

## Chantiers

- **A. Renommage** izi kit/izikit → Starter Kit (≈30 occurrences, ~15 fichiers). Ajuster
  les tripwires qui asservissent des chaînes exactes.
- **B. Homepage FR** — `frontend/src/app/page.tsx` réécrite en français, headless/Tailwind.
- **C. DB deux options** — setup-kit Phase 3 réécrite (Neon + self-host Supabase + Cloudflare).
  Généraliser `.env.example` (retirer hostname MonSplit) + relâcher `env-shape.test.ts`.
- **D. Google Auth** — vérifier routes start/callback ; documenter setup (redirect URI, keys).
- **E. Stripe** — stub `payments/stripe.ts` + doc alternative.
- **F. Auto-install superpowers + context-mode** — setup-kit Phase 2 via `claude plugin`.
- **G. Mémoire cross-agent** — `.mcp.json` + doc Codex/OpenCode context-mode.
- **H. Phase brainstorming finale** — setup-kit Phase 8.
- **I. Deux pushes** — repo `starter-kit` (template public) + MonSplit.

## Gate qualité

`pnpm format && pnpm lint && pnpm typecheck && pnpm test` doit passer vert avant tout push.
