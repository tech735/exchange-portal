import { test, expect, authFile, settled } from './fixtures';

test.use({ storageState: authFile('ADMIN') });

const PAGES: [string, string, RegExp][] = [
  ['Dashboard', '/dashboard', /Good (morning|afternoon|evening)/],
  ['Exchanges', '/exchanges', /^Exchanges$/],
  ['Warehouse', '/warehouse', /^Warehouse$/],
  ['Shipments', '/shipments', /^Shipments$/],
  ['Cases', '/cases', /^Cases$/],
  ['Finance', '/finance', /^Finance$/],
  ['Users', '/users', /^Users & roles$/],
  ['Settings', '/settings', /^Settings$/],
];

test('full page loads are fast (cold start of each page)', async ({ page }) => {
  test.setTimeout(180_000);
  const results: string[] = [];
  for (const [name, path, heading] of PAGES) {
    const t0 = Date.now();
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible({ timeout: 10_000 });
    await settled(page);
    const ms = Date.now() - t0;
    const lcp = await page.evaluate(() => new Promise<number>((res) => {
      new PerformanceObserver((l) => { const e = l.getEntries(); res(Math.round(e[e.length - 1]?.startTime ?? 0)); }).observe({ type: 'largest-contentful-paint', buffered: true });
      setTimeout(() => res(-1), 1500);
    }));
    results.push(`${name}: ready ${ms} ms, LCP ${lcp} ms`);
    expect(ms, `${name} took too long to become usable`).toBeLessThan(5000);
  }
  test.info().annotations.push({ type: 'timing', description: results.join(' | ') });
});

test('in-app navigation between pages is near-instant', async ({ page }) => {
  await page.goto('/dashboard');
  await settled(page);
  const nav = page.getByRole('navigation', { name: 'Main' }).first();
  const results: string[] = [];
  for (const [name, , heading] of PAGES.slice(1)) {
    const link = nav.getByRole('link', { name: new RegExp(`^${name === 'Users' ? 'Users & roles' : name}`) });
    const t0 = Date.now();
    await link.click();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    const ms = Date.now() - t0;
    results.push(`${name}: ${ms} ms`);
    expect(ms, `switching to ${name}`).toBeLessThan(2500);
  }
  test.info().annotations.push({ type: 'timing', description: results.join(' | ') });
});

test('typing in search and filters stays responsive', async ({ page }) => {
  await page.goto('/exchanges');
  await settled(page);
  const box = page.getByPlaceholder('Order, name, phone, AWB…');
  const t0 = Date.now();
  await box.pressSequentially('E2E-TEST-100', { delay: 20 });
  await expect(page.locator('table tbody tr').first()).toContainText('E2E-TEST-100');
  const ms = Date.now() - t0;
  test.info().annotations.push({ type: 'timing', description: `search typing + filter ${ms} ms` });
  expect(ms).toBeLessThan(3000);
});
