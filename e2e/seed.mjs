// Creates temporary test accounts (one per role) and E2E-TEST-… records in
// every workflow stage. Writes credentials + ids to E2E_STATE (outside the repo).
import fs from 'node:fs';
import crypto from 'node:crypto';
import { loadEnv, client, TEST_PREFIX, USER_DOMAIN } from './lib.mjs';

const env = loadEnv();
const db = client(env);
const statePath = process.env.E2E_STATE;
if (!statePath) throw new Error('Set E2E_STATE to a path for the generated state file');

const roles = ['ADMIN', 'SUPPORT', 'WAREHOUSE', 'INVOICING'];
const users = {};

// ---- accounts
const existing = (await db.auth('GET', '/admin/users?per_page=1000')).users ?? [];
for (const role of roles) {
  const email = `e2e-${role.toLowerCase()}${USER_DOMAIN}`;
  const password = crypto.randomBytes(12).toString('base64url') + 'aA1!';
  let u = existing.find((x) => x.email === email);
  if (u) await db.auth('PUT', `/admin/users/${u.id}`, { password, email_confirm: true });
  else u = await db.auth('POST', '/admin/users', { email, password, email_confirm: true });
  await db.rest('POST', 'profiles', '?on_conflict=id', { id: u.id, email, full_name: `E2E ${role === 'INVOICING' ? 'Finance' : role[0] + role.slice(1).toLowerCase()}`, role }, 'resolution=merge-duplicates');
  users[role] = { id: u.id, email, password };
}

// ---- products to build items from (real catalogue, read only)
const products = await db.rest('GET', 'product_catalog', '?active=eq.true&select=sku,product_name,variants,variant_skus,variant_inventory,variant_prices,price');
const stocked = (p) => (p.variants ?? []).map((v, i) => ({ size: v, sku: p.variant_skus?.[i], stock: Number(p.variant_inventory?.[p.variant_skus?.[i]] ?? 0), price: Number(p.variant_prices?.[p.variant_skus?.[i]] ?? p.price ?? 0) })).filter((x) => x.sku && x.stock > 0);
const single = products.find((p) => (p.variants ?? []).every((v) => !String(v).includes(' / ')) && stocked(p).length >= 3);
const grouped = products.find((p) => (p.variants ?? []).length > 0 && (p.variants ?? []).every((v) => String(v).includes(' / ')) && new Set(stocked(p).map((x) => x.size.split(' / ')[0])).size >= 2 && stocked(p).length >= 3);
if (!single || !grouped) throw new Error('Could not find suitable catalogue products');
const s = stocked(single), g = stocked(grouped);
const item = (p, v) => ({ sku: v.sku, product_name: p.product_name, size: v.size, qty: 1, price: v.price });

// ---- tickets in each stage
const now = Date.now();
const iso = (hoursAgo) => new Date(now - hoursAgo * 36e5).toISOString();
const base = (n, extra) => ({
  order_id: `${TEST_PREFIX}${n}`,
  customer_name: `E2E Customer ${n}`,
  customer_phone: `90000${n}`,
  customer_email: `customer${n}${USER_DOMAIN}`,
  reason_code: 'WRONG_SIZE',
  reason_notes: 'Automated end-to-end test record',
  return_items: [item(single, s[0])],
  exchange_items: [item(single, s[1])],
  assigned_team: 'support',
  request_source: 'WHATSAPP',
  created_by_user_id: users.ADMIN.id,
  stage: 'LODGED',
  status: 'NEW',
  ...extra,
});
const seed = [
  base(1001, {}),
  base(1002, { status: 'COMPLETED', is_paid: true, amount_collected: 150, exchange_completed_at: iso(5), return_items: [item(grouped, g[0])], exchange_items: [item(grouped, g[1])] }),
  base(1003, { stage: 'RETURN_PENDING', status: 'COMPLETED', is_paid: true, exchange_completed_at: iso(30), return_aggregator: 'SHIPROCKET', return_awb: 'E2EAWB1003', return_booked_at: iso(20) }),
  base(1004, { stage: 'RETURN_RECEIVED', status: 'COMPLETED', is_paid: true, exchange_completed_at: iso(50), return_awb: 'E2EAWB1004', return_booked_at: iso(40), return_received_at: iso(2) }),
  base(1005, { stage: 'WAREHOUSE_APPROVED', status: 'COMPLETED', is_paid: true, exchange_completed_at: iso(70), return_awb: 'E2EAWB1005', return_received_at: iso(10), qc_decision: 'APPROVED', warehouse_approved_at: iso(5) }),
  base(1006, { stage: 'EXCHANGE_BOOKED', status: 'COMPLETED', is_paid: true, amount_collected: 150, exchange_completed_at: iso(90), qc_decision: 'APPROVED', exchange_aggregator: 'ITHINK', exchange_awb: 'E2EAWB1006X', exchange_booked_at: iso(3) }),
  base(1007, { stage: 'INVOICED', status: 'COMPLETED', is_paid: true, refund_amount: 200, refund_status: 'PENDING', invoicing_done_at: iso(4), exchange_completed_at: iso(100) }),
];
const tickets = [];
for (const t of seed) tickets.push(...(await db.rest('POST', 'tickets', '?select=id,order_id', t, 'return=representation')));

// ---- a case on the board
const cases = await db.rest('POST', 'order_special_cases', '?select=id,order_name', [
  { order_name: `${TEST_PREFIX}1101`, case_type: 'OTHER', issue: 'Automated test case — parcel stuck at hub', status: 'OPEN', board_stage: 'NEW', updated_by: 'E2E Admin' },
], 'return=representation');

// ---- remember settings so cleanup can restore them exactly
const settings = await db.rest('GET', 'app_settings', '?select=key,value');

fs.writeFileSync(statePath, JSON.stringify({
  users,
  tickets: Object.fromEntries(tickets.map((t) => [t.order_id, t.id])),
  cases: Object.fromEntries(cases.map((c) => [c.order_name, c.id])),
  products: {
    single: { name: single.product_name, sku: single.sku, sizes: s.slice(0, 4) },
    grouped: { name: grouped.product_name, sku: grouped.sku, sizes: g.slice(0, 4) },
  },
  settings,
}, null, 2));
console.log(`Seeded ${Object.keys(users).length} accounts, ${tickets.length} tickets, ${cases.length} case. Products: "${single.product_name}" / "${grouped.product_name}"`);
