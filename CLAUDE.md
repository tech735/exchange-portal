# KOTU exchange portal: project rules for Claude Code

General coding and security rules live in the global `~/.claude/CLAUDE.md`. This file adds what is specific to this repo.

## Project context
- Stack: React 18 + TypeScript, Vite 5, Tailwind + shadcn/Radix, React Query, Recharts
- Backend: Supabase (Postgres with RLS, Auth, Storage, Edge Functions in Deno under `supabase/functions/`)
- Hosting: Vercel, deploys `main` to exchange.kotu.co.in. Work happens on `revamp`; merging to `main` = going live, always ask first
- CI: GitHub Actions (`.github/workflows/security.yml`)
- Commands: lint `npm run lint` | typecheck `npx tsc --noEmit -p tsconfig.app.json` | build `npm run build` | dev `npm run dev` | e2e `npm run test:e2e` (needs seed/cleanup, see README)
- UI work: follow `src/components/app/README.md`. Brand: Indigo #02019B, Poppins headings, Inter text. Order numbers never show "#".

## Security model of this app
- **The GitHub repo is public.** Anything ever committed is readable by anyone, history included.
- **Authorization is enforced by Postgres RLS**, not by the React app. The role permissions under Users & roles (`src/lib/navigation.ts`) only shape the UI. Any rule that must really hold (admin-only, own-record-only) needs an RLS policy or a check inside the edge function.
- Edge functions: verify the caller with `requireCaller` from `supabase/functions/_shared/auth.ts` and check the role server-side before doing anything privileged.
- `VITE_*` variables are public (bundled into the site). Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` belong there. Server secrets (Resend, Shopify, couriers, MSG91, service role key) are set with `supabase secrets set` and are only read inside edge functions.
- Never use the service role key in `src/`. The E2E scripts use it from an env file outside the repo, which is deleted after each run.
- Customer, parent and student data (names, phones, addresses, school) is personal data under the DPDP Act: don't log it, don't put it in URLs, return only needed columns.
- Schema changes go in a new file in `supabase/migrations/` with RLS enabled and explicit policies. Show the plan first.

## Before saying a task is done
1. Lint, typecheck and build pass; run the relevant Playwright specs when behaviour changed.
2. `gitleaks git --staged --redact .` is clean (the pre-commit hook does this once `git config core.hooksPath .githooks` is set).
3. Summarise security-relevant decisions and any `TODO(upgrade)` markers.
