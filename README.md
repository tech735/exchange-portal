# KOTU exchange portal

Internal staff app for school-uniform exchanges, live at **exchange.kotu.co.in**.
Customers ask for an exchange by email, WhatsApp, phone or helpdesk; support lodges it here and
it moves through pickup → warehouse QC → replacement shipped → finance settlement.

## Stack

React 18 + TypeScript, Vite, Tailwind with shadcn/Radix components, React Query, Recharts,
Supabase (Postgres with RLS, Auth, Storage, Edge Functions). Deployed on Vercel from `main`.

## Getting started

```sh
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev            # http://localhost:8080
```

| Script | What it does |
| --- | --- |
| `npm run build` | Production build into `dist/` |
| `npm run lint` | ESLint |
| `npm run knip:ci` | Finds unused files, exports and dependencies |
| `npm run test:e2e` | Playwright end-to-end suite (see below) |

## Where things live

| Path | Contents |
| --- | --- |
| `src/pages/` | One folder per screen: Dashboard, Exchanges, Warehouse, Cases, Finance, Orders, Shipments, Settings, Users |
| `src/components/app/` | The shared UI kit (page header, cards, KPI tiles, badges…). Read its README before building UI |
| `src/components/ui/` | shadcn primitives |
| `src/lib/exchangeStatus.ts` | The single status shown for an exchange, derived from the DB `stage`/`status` columns |
| `src/lib/navigation.ts` | Pages and which roles can open them |
| `src/hooks/` | Data hooks (React Query + Supabase) |
| `supabase/migrations/` | Schema, RLS policies, triggers and cron jobs |
| `supabase/functions/` | Edge Functions: user management, team e-mails, SLA escalation, Shopify sync, shipment tracking and alerts |
| `e2e/` | Playwright specs plus seed/cleanup scripts |

## Roles

Admin, Support, Warehouse and Finance (`INVOICING` in the database). Admins assign roles and
choose which pages each role can open under **Users & roles**.

## End-to-end tests

The suite runs against the live database using temporary `@e2e.kotu.test` accounts and
`E2E-TEST-…` records, which the notification trigger ignores.

```sh
E2E_SECRETS=/path/to/secrets.json node e2e/seed.mjs
npm run test:e2e
E2E_SECRETS=/path/to/secrets.json node e2e/cleanup.mjs
```

The secrets file holds the service-role key. Never commit it.

## Server-side secrets

Edge Function secrets (Resend, Shopify, courier APIs, MSG91) are set with
`supabase secrets set`; `.env.example` lists them and explains how alerts are routed.
