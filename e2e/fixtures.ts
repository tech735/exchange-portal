import { test as base, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export type Role = 'ADMIN' | 'SUPPORT' | 'WAREHOUSE' | 'INVOICING';

export interface E2EState {
  users: Record<Role, { id: string; email: string; password: string }>;
  tickets: Record<string, string>;
  cases: Record<string, string>;
  products: {
    single: { name: string; sku: string; sizes: { size: string; sku: string; price: number }[] };
    grouped: { name: string; sku: string; sizes: { size: string; sku: string; price: number }[] };
  };
}

export function loadState(): E2EState {
  const p = process.env.E2E_STATE;
  if (!p || !fs.existsSync(p)) throw new Error('E2E_STATE not set — run e2e/seed.mjs first');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export const authFile = (role: Role) => path.join(path.dirname(process.env.E2E_STATE ?? '.e2e/x'), `auth-${role}.json`);

// External sites the app opens (payments, invoicing, couriers) are never contacted from tests.
const EXTERNAL = /razorpay\.com|zoho\.(in|com)|shiprocket\.in|ithinklogistics\.com|shipdelight\.com|wa\.me/;

// Console noise that is not an app error.
// "Failed to fetch" = a request cut off because the test navigated away mid-load.
const IGNORED = [/Failed to fetch/, /Failed to send a request to the Edge Function/, /Download the React DevTools/, /favicon/, /ResizeObserver loop/, /net::ERR_ABORTED/, /ERR_FAILED/];

export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [async ({ page, context }, use, testInfo) => {
    const errors: string[] = [];
    await context.route(EXTERNAL, (r) => r.abort());
    context.on('page', (p) => { if (p !== page) p.close().catch(() => {}); }); // popups from window.open
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !IGNORED.some((r) => r.test(m.text()))) errors.push(`console: ${m.text()}`);
    });
    await use(errors);
    if (errors.length) {
      await testInfo.attach('console-errors', { body: errors.join('\n'), contentType: 'text/plain' });
      expect(errors, 'browser console / page errors during the test').toEqual([]);
    }
  }, { auto: true }],
});

export { expect };

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/**
 * Human-style drag: press, nudge, then glide to the target in steps. Playwright's
 * one-jump dragTo can make Chromium start the drag from the wrong spot.
 */
export async function humanDrag(page: Page, from: import('@playwright/test').Locator, to: import('@playwright/test').Locator) {
  await from.scrollIntoViewIfNeeded();
  const a = (await from.boundingBox())!;
  const startY = a.y + Math.min(30, a.height / 2);
  await page.mouse.move(a.x + a.width / 2, startY);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 6, startY + 6, { steps: 4 });
  await to.scrollIntoViewIfNeeded();
  const b = (await to.boundingBox())!;
  // Drop level with the card, kept inside the target column: once a long column has
  // scrolled the page, the top of the target column can be above the viewport.
  const dropY = Math.max(b.y + 20, Math.min(startY, b.y + b.height - 20));
  await page.mouse.move(b.x + b.width / 2, dropY, { steps: 12 });
  await page.mouse.up();
}

/** Wait until the page shell has rendered and no loading skeleton is left. */
export async function settled(page: Page) {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 });
}
