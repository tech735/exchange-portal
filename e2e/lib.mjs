// Shared helpers for the E2E seed / cleanup scripts (service-role REST calls).
// Never commit keys: they are read from the env file passed in E2E_SECRETS.
import fs from 'node:fs';

export function loadEnv() {
  const file = process.env.E2E_SECRETS;
  if (!file || !fs.existsSync(file)) throw new Error('Set E2E_SECRETS to the env file with SUPABASE_URL / SERVICE_KEY / ANON_KEY');
  const env = Object.fromEntries(fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  return env;
}

export function client({ SUPABASE_URL, SERVICE_KEY }) {
  const h = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
  const call = async (method, path, body, extra = {}) => {
    const r = await fetch(`${SUPABASE_URL}${path}`, { method, headers: { ...h, ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await r.text();
    if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  };
  return {
    rest: (method, table, query = '', body, prefer) => call(method, `/rest/v1/${table}${query}`, body, prefer ? { Prefer: prefer } : {}),
    auth: (method, path, body) => call(method, `/auth/v1${path}`, body),
    storage: (method, path, body) => call(method, `/storage/v1${path}`, body),
  };
}

export const TEST_PREFIX = 'E2E-TEST-';
export const USER_DOMAIN = '@e2e.kotu.test';
