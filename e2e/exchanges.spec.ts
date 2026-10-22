import { test, expect, loadState, authFile, settled } from './fixtures';

const state = loadState();
test.use({ storageState: authFile('SUPPORT') });

test('list: views, search, filters, thumbnails, selection and export', async ({ page }) => {
  await page.goto('/exchanges');
  await settled(page);
  await expect(page.getByRole('tab', { name: /All open/ })).toBeVisible();
  await page.getByPlaceholder('Order, name, phone, AWB…').fill('E2E-TEST');
  const rows = page.locator('table tbody tr');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThanOrEqual(5);
  // Item cell shows a clean size change and a real product photo
  await expect(rows.filter({ hasText: 'E2E-TEST-1001' }).getByText('→').first()).toBeVisible();
  await expect(rows.filter({ hasText: 'E2E-TEST-1002' }).locator('img').first()).toBeVisible();

  // Saved view
  await page.getByRole('tab', { name: /Needs payment/ }).click();
  await expect(rows.filter({ hasText: 'E2E-TEST-1001' })).toHaveCount(1);
  await expect(rows.filter({ hasText: 'E2E-TEST-1002' })).toHaveCount(0);

  // Filter chip
  await page.getByRole('tab', { name: /All open/ }).click();
  await page.getByRole('combobox', { name: /Source|Any source/ }).or(page.locator('button[role=combobox]').filter({ hasText: 'Any source' })).first().click();
  await page.getByRole('option', { name: 'WhatsApp' }).click();
  await expect(page.getByText('Source: WhatsApp')).toBeVisible();
  await page.getByRole('button', { name: 'Remove filter' }).click();

  // Select rows → bulk bar → export
  await page.getByRole('checkbox', { name: 'Select E2E-TEST-1001' }).click();
  await page.getByRole('checkbox', { name: 'Select E2E-TEST-1002' }).click();
  await expect(page.getByText('2 selected')).toBeVisible();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Export$/ }).last().click();
  expect((await dl).suggestedFilename()).toMatch(/\.csv$/);
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await expect(page.getByText('2 selected')).toHaveCount(0);
});

test('detail: next action, payment, owner, notes and navigation', async ({ page }) => {
  await page.goto('/exchanges');
  await settled(page);
  await page.getByPlaceholder('Order, name, phone, AWB…').fill('E2E-TEST-1001');
  await page.locator('table tbody tr', { hasText: 'E2E-TEST-1001' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('E2E-TEST-1001');
  await settled(page);
  await expect(page.getByText('Requested', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('via WhatsApp')).toBeVisible();
  // Items show product name without variant repetition and a photo
  await expect(page.getByText('Returning')).toBeVisible();
  await expect(page.locator('section', { hasText: 'Returning' }).locator('img').first()).toBeVisible();

  // Owner
  await page.getByRole('combobox', { name: 'Owner' }).click();
  await page.getByRole('option', { name: 'E2E Support' }).click();
  await expect(page.getByRole('combobox', { name: 'Owner' })).toContainText('E2E Support');

  // Internal note
  await page.getByPlaceholder(/Add an internal note/).fill('E2E note: customer called back');
  await page.getByRole('button', { name: 'Post note' }).click();
  await expect(page.getByText('E2E note: customer called back')).toBeVisible();

  // Record payment → moves to warehouse
  await page.getByRole('button', { name: /Record payment/ }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: /Record (payment|refund due)/ }).click();
  await expect(page.getByText(/Payment recorded|Refund marked as due/).first()).toBeVisible();
  await expect(page.getByText('To book pickup').first()).toBeVisible();
});

test('detail page for a missing exchange shows a friendly message', async ({ page, consoleErrors }) => {
  await page.goto('/exchanges/00000000-0000-0000-0000-000000000000');
  await expect(page.getByText('Exchange not found')).toBeVisible();
  // The not-found response itself (406 from the API) is expected.
  const keep = consoleErrors.filter((e) => !/status of 406/.test(e));
  consoleErrors.splice(0, consoleErrors.length, ...keep);
});
