import { test, expect, loadState, authFile, settled, type Role } from './fixtures';

const state = loadState();
const denied = /This page isn’t part of your role/;

const cases: { role: Role; allowed: string[]; blocked: string[]; nav: string[]; noNav: string[] }[] = [
  { role: 'ADMIN', allowed: ['/users', '/settings', '/finance', '/warehouse'], blocked: [], nav: ['Exchanges', 'Warehouse', 'Finance', 'Users & roles', 'Settings'], noNav: [] },
  { role: 'SUPPORT', allowed: ['/exchanges', '/orders', '/shipments', '/cases'], blocked: ['/warehouse', '/finance', '/users', '/settings'], nav: ['Exchanges', 'Orders', 'Cases'], noNav: ['Warehouse', 'Finance', 'Users & roles'] },
  { role: 'WAREHOUSE', allowed: ['/warehouse', '/shipments', '/cases'], blocked: ['/exchanges', '/exchanges/new', '/orders', '/finance'], nav: ['Warehouse', 'Shipments'], noNav: ['Exchanges', 'Finance', 'Orders'] },
  { role: 'INVOICING', allowed: ['/finance'], blocked: ['/exchanges', '/warehouse', '/cases', '/users'], nav: ['Finance'], noNav: ['Exchanges', 'Warehouse', 'Cases'] },
];

for (const c of cases) {
  test.describe(`${c.role} access`, () => {
    test.use({ storageState: authFile(c.role) });

    test('sidebar shows only this role’s areas', async ({ page }) => {
      await page.goto('/dashboard');
      const nav = page.getByRole('navigation', { name: 'Main' }).first();
      for (const n of c.nav) await expect(nav.getByRole('link', { name: new RegExp(`^${n}`) })).toBeVisible();
      for (const n of c.noNav) await expect(nav.getByRole('link', { name: new RegExp(`^${n}`) })).toHaveCount(0);
    });

    test('allowed pages open, blocked pages explain why', async ({ page }) => {
      for (const p of c.allowed) {
        await page.goto(p);
        await expect(page.getByText(denied)).toHaveCount(0);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      }
      for (const p of c.blocked) {
        await page.goto(p);
        await expect(page.getByText(denied)).toBeVisible();
      }
    });

    if (c.role === 'WAREHOUSE' || c.role === 'INVOICING') {
      test('can open an exchange from its queue (no Access Denied)', async ({ page }) => {
        await page.goto(`/exchanges/${state.tickets['E2E-TEST-1004']}`);
        await settled(page);
        await expect(page.getByRole('heading', { level: 1 })).toContainText('E2E-TEST-1004');
        await expect(page.getByText(denied)).toHaveCount(0);
      });
    }
  });
}
