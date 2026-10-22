// Load test: many staff using the portal at once.
// 1) Database/API: signs in as the temporary E2E admin and fires the same queries
//    the app makes on its busiest screens, N at a time.
// 2) Website: requests the app shell and its JS bundle from the hosting CDN.
import fs from 'node:fs';
import { loadEnv } from './lib.mjs';

const env = loadEnv();
const state = JSON.parse(fs.readFileSync(process.env.E2E_STATE, 'utf8'));
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY ?? 30);
const TOTAL = Number(process.env.LOAD_TOTAL ?? 600);
const SITE = process.env.LOAD_SITE ?? 'https://exchange.kotu.co.in';

const pct = (a, p) => a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
async function run(name, total, conc, fn) {
  const times = []; let errors = 0; let i = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: conc }, async () => {
    while (i < total) {
      const n = i++;
      const s = performance.now();
      try { const r = await fn(n); if (!r.ok) errors++; await r.arrayBuffer(); } catch { errors++; }
      times.push(performance.now() - s);
    }
  }));
  times.sort((a, b) => a - b);
  const secs = (Date.now() - t0) / 1000;
  console.log(`${name.padEnd(34)} ${String(total).padStart(4)} req @${conc} | p50 ${pct(times, 50).toFixed(0)}ms  p95 ${pct(times, 95).toFixed(0)}ms  p99 ${pct(times, 99).toFixed(0)}ms  max ${times.at(-1).toFixed(0)}ms | ${(total / secs).toFixed(1)} req/s | errors ${errors}`);
  return { errors, p95: pct(times, 95) };
}

// Sign in like the app does
const auth = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: env.ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: state.users.ADMIN.email, password: state.users.ADMIN.password }),
}).then((r) => r.json());
if (!auth.access_token) throw new Error('sign-in failed');
const H = { apikey: env.ANON_KEY, Authorization: `Bearer ${auth.access_token}` };
const api = (path) => fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { headers: H });

const queries = [
  'tickets?select=*&order=created_at.desc',                       // exchanges list / dashboard / warehouse
  `profiles?select=*&id=eq.${state.users.ADMIN.id}`,               // session restore
  'product_catalog?select=*&active=eq.true&order=product_name',    // item photos, size picker
  'order_special_cases?select=*&order=status.asc&order=updated_at.desc', // cases
  'ticket_events?select=*&order=event_at.desc&limit=15',           // notifications
  'app_settings?select=key,value',                                 // settings
];

console.log(`Load test · ${new Date().toISOString()}`);
const results = [];
results.push(await run('API: mixed app queries', TOTAL, CONCURRENCY, (n) => api(queries[n % queries.length])));
results.push(await run('API: exchanges list only', Math.round(TOTAL / 2), CONCURRENCY, () => api(queries[0])));

const html = await fetch(SITE).then((r) => r.text());
const js = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
results.push(await run('Website: app shell (HTML)', TOTAL, CONCURRENCY, () => fetch(SITE, { headers: { 'Cache-Control': 'no-cache' } })));
if (js) results.push(await run('Website: main JS bundle', Math.round(TOTAL / 2), CONCURRENCY, () => fetch(SITE + js)));

const errors = results.reduce((s, r) => s + r.errors, 0);
console.log(errors ? `FAILED: ${errors} errors` : 'OK: no errors under load');
process.exitCode = errors ? 1 : 0;
