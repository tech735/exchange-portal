// Removes everything the E2E run created: E2E-TEST-… tickets (+ events, QC photos),
// cases (+ updates), the temporary accounts, and restores app_settings.
import fs from 'node:fs';
import { loadEnv, client, TEST_PREFIX, USER_DOMAIN } from './lib.mjs';

const env = loadEnv();
const db = client(env);
const state = process.env.E2E_STATE && fs.existsSync(process.env.E2E_STATE) ? JSON.parse(fs.readFileSync(process.env.E2E_STATE, 'utf8')) : null;
const like = encodeURIComponent(`${TEST_PREFIX}%`);

const tickets = await db.rest('GET', 'tickets', `?order_id=like.${like}&select=id`);
const ids = tickets.map((t) => t.id);

// QC photos are stored under <ticket id>/…
let photos = 0;
for (const id of ids) {
  const files = await db.storage('POST', '/object/list/qc-photos', { prefix: id, limit: 100 });
  const paths = (files ?? []).filter((f) => f.name).map((f) => `${id}/${f.name}`);
  if (paths.length) { await db.storage('DELETE', '/object/qc-photos', { prefixes: paths }); photos += paths.length; }
}
if (ids.length) {
  await db.rest('DELETE', 'ticket_events', `?ticket_id=in.(${ids.join(',')})`);
  await db.rest('DELETE', 'tickets', `?id=in.(${ids.join(',')})`);
}
const cases = await db.rest('DELETE', 'order_special_cases', `?order_name=like.${like}&select=id`, undefined, 'return=representation');

// Accounts: the seeded ones plus any created through the Users page during the run
const all = (await db.auth('GET', '/admin/users?per_page=1000')).users ?? [];
const testUsers = all.filter((u) => (u.email ?? '').endsWith(USER_DOMAIN));
for (const u of testUsers) {
  await db.rest('DELETE', 'profiles', `?id=eq.${u.id}`);
  await db.auth('DELETE', `/admin/users/${u.id}`);
}

// Settings back to exactly what they were before the run
if (state?.settings) {
  for (const row of state.settings) await db.rest('POST', 'app_settings', '?on_conflict=key', { key: row.key, value: row.value }, 'resolution=merge-duplicates');
  // …and drop rows the run added (e.g. role_permissions saved from Users & roles)
  const keep = state.settings.map((r) => `"${r.key}"`).join(',');
  await db.rest('DELETE', 'app_settings', keep ? `?key=not.in.(${keep})` : '?key=not.is.null');
}

const left = await db.rest('GET', 'tickets', `?order_id=like.${like}&select=id`);
console.log(`Removed ${ids.length} tickets, ${photos} QC photos, ${cases?.length ?? 0} cases, ${testUsers.length} accounts. Settings restored: ${!!state?.settings}. Remaining test tickets: ${left.length}`);
