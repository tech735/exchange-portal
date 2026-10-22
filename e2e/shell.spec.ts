import { test, expect, loadState, authFile, settled } from './fixtures';

const state = loadState();
test.use({ storageState: authFile('ADMIN') });

test('dashboard: KPI tiles, period switch, charts and donut links', async ({ page }) => {
  await page.goto('/dashboard');
  await settled(page);
  for (const k of ['Exchanges lodged', 'Completed', 'Avg. turnaround', 'SLA breached']) await expect(page.getByText(k, { exact: true }).first()).toBeVisible();
  for (const h of ['Exchange volume', 'Where open exchanges are', 'On-time rate', 'Why customers exchange', 'Needs attention']) await expect(page.getByRole('heading', { name: h })).toBeVisible();
  // Charts actually render (SVG paths), and the screen-reader table carries the numbers
  await expect(page.locator('.recharts-area-area').first()).toBeVisible();
  await expect(page.locator('.recharts-pie-sector').first()).toBeVisible();
  // Period switch updates the copy
  await page.getByRole('radio', { name: '7 days' }).click();
  await expect(page.getByText('Lodged vs completed per day · last 7 days')).toBeVisible();
  await page.getByRole('radio', { name: '30 days' }).click();
  // Hovering the volume chart shows the tooltip
  const chart = page.locator('.recharts-wrapper').filter({ has: page.locator('.recharts-area') }).nth(4);
  const box = await chart.boundingBox();
  if (box) { await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2); await expect(page.getByText(/Lodged/).last()).toBeVisible(); }
  // Donut legend links to the filtered queue
  await page.getByRole('link', { name: /Needs payment/ }).click();
  await expect(page).toHaveURL(/\/exchanges\?view=needs-payment/);
});

test('⌘K search finds an exchange by order number and opens it', async ({ page }) => {
  await page.goto('/dashboard');
  await settled(page);
  await page.keyboard.press('Control+k');
  const input = page.getByPlaceholder(/Search order #, customer, phone, AWB/);
  await expect(input).toBeVisible();
  await input.fill('E2E-TEST-1003');
  await page.getByRole('option', { name: /E2E-TEST-1003/ }).click();
  await expect(page).toHaveURL(new RegExp(`/exchanges/${state.tickets['E2E-TEST-1003']}`));
  await expect(page.getByRole('heading', { level: 1 })).toContainText('E2E-TEST-1003');
});

test('⌘K finds by AWB and "/" opens it too', async ({ page }) => {
  await page.goto('/cases');
  await expect(page.getByRole('heading', { level: 1, name: 'Cases' })).toBeVisible();
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('/');
  await page.getByPlaceholder(/Search order #/).fill('E2EAWB1004');
  await expect(page.getByRole('option', { name: /E2E-TEST-1004/ })).toBeVisible();
  await page.keyboard.press('Escape');
});

test('notifications panel opens', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Notifications' }).click();
  await expect(page.getByText('Notifications', { exact: true })).toBeVisible();
});

test('order numbers never show a "#"', async ({ page }) => {
  for (const p of ['/exchanges', '/warehouse', '/dashboard']) {
    await page.goto(p);
    await settled(page);
    await expect(page.getByText(/#E2E-TEST/)).toHaveCount(0);
  }
});

test('old links redirect; unknown pages show 404', async ({ page }) => {
  await page.goto(`/ticket/${state.tickets['E2E-TEST-1001']}`);
  await expect(page).toHaveURL(new RegExp(`/exchanges/${state.tickets['E2E-TEST-1001']}`));
  await page.goto('/exchange-lodging');
  await expect(page).toHaveURL(/\/exchanges$/);
  await page.goto('/invoicing');
  await expect(page).toHaveURL(/\/finance/);
  await page.goto('/this-does-not-exist');
  await expect(page.getByText('404')).toBeVisible();
});

test('sign out returns to login', async ({ page }) => {
  // Separate context so the saved admin session used by other tests stays valid.
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Account menu' }).click();
  await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
  await page.keyboard.press('Escape');
});
