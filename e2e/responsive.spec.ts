import { test, expect, loadState, authFile, settled } from './fixtures';
import type { Page } from '@playwright/test';

const state = loadState();
test.use({ storageState: authFile('ADMIN') });

const ROUTES = ['/dashboard', '/exchanges', `/exchanges/${state.tickets['E2E-TEST-1003']}`, '/exchanges/new', '/warehouse', '/shipments', '/cases', '/finance', '/users', '/settings'];

async function noSideScroll(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  return sw <= cw + 1;
}

for (const vp of [
  { name: 'small phone', width: 320, height: 640 }, { name: 'phone', width: 390, height: 844 }, { name: 'large phone', width: 430, height: 932 },
  { name: 'tablet', width: 768, height: 1024 }, { name: 'tablet landscape', width: 1024, height: 768 },
  { name: 'laptop', width: 1280, height: 800 }, { name: 'large monitor', width: 1920, height: 1080 },
]) {
  test(`${vp.name} (${vp.width}px): every page fits without sideways scrolling`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const wide: string[] = [];
    for (const r of ROUTES) {
      await page.goto(r);
      await settled(page);
      // Board pages scroll their own board area by design; the page itself must not.
      if (!(await noSideScroll(page))) wide.push(`${r} (${await page.evaluate(() => document.documentElement.scrollWidth)}px)`);
    }
    expect(wide, `pages wider than the screen at ${vp.width}px`).toEqual([]);
  });
}

test('phone: tab bar, menu drawer, card lists and sticky next action', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  const tabbar = page.getByRole('navigation', { name: 'Quick' });
  await expect(tabbar).toBeVisible();
  await tabbar.getByRole('button', { name: 'More' }).click();
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Close menu' }).click();

  await page.goto('/exchanges?q=E2E-TEST');
  await settled(page);
  await expect(page.locator('table')).toBeHidden();
  await expect(page.locator('ul li').filter({ hasText: 'E2E-TEST' }).first()).toBeVisible();

  await page.goto(`/exchanges/${state.tickets['E2E-TEST-1003']}`);
  await settled(page);
  await expect(page.getByRole('button', { name: /Mark return received|Book return pickup|Run quality check|Record payment|Ship replacement/ }).last()).toBeInViewport();
});

test('tablet: icon sidebar instead of the full menu', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 1112 });
  await page.goto('/dashboard');
  await expect(page.locator('aside').first()).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Quick' })).toBeHidden();
});
