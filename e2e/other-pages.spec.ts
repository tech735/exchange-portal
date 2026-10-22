import { test, expect, authFile, settled } from './fixtures';

test.describe('Shipments & Orders', () => {
  test.use({ storageState: authFile('SUPPORT') });

  test('shipments: tabs, custom range, selection and export dialog', async ({ page }) => {
    await page.goto('/shipments');
    await settled(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Shipments' })).toBeVisible();
    await page.getByRole('tab', { name: /Exchanges & returns/ }).click();
    await page.getByRole('tab', { name: /Daily report/ }).click();
    await page.getByRole('tab', { name: /Forward/ }).click();

    await page.getByRole('combobox', { name: 'Period' }).click();
    await page.getByRole('option', { name: 'Custom range…' }).click();
    await expect(page.getByLabel('From')).toBeVisible();
    await expect(page.getByLabel('To', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /^Export$/ }).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg.getByText('Export shipments')).toBeVisible();
    await dlg.getByRole('radio', { name: /A date range/ }).click();
    await dlg.getByRole('button', { name: 'Last 7 days' }).click();
    await dlg.getByRole('radio', { name: 'CSV' }).click();
    const outcome = Promise.race([
      page.waitForEvent('download').then((d) => `download:${d.suggestedFilename()}`),
      page.getByText('Nothing to export').waitFor().then(() => 'empty'),
    ]);
    await dlg.getByRole('button', { name: /Download/ }).click();
    expect(await outcome).toMatch(/download:.*\.csv|empty/);
  });

  test('orders: live Shopify list loads and the order panel opens', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/orders');
    await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 45_000 });
    await expect(firstRow).not.toContainText('#');
    await firstRow.click();
    await expect(page.getByRole('button', { name: /Start exchange/ }).first()).toBeVisible();
  });
});

test.describe('Admin', () => {
  test.use({ storageState: authFile('ADMIN') });

  test('users: add a person, change role, remove', async ({ page }) => {
    await page.goto('/users');
    await settled(page);
    await page.getByRole('button', { name: 'Add person' }).first().click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('Full name').fill('E2E UI User');
    await dlg.getByLabel('Work email').fill('e2e-ui-user@e2e.kotu.test');
    await dlg.getByLabel('Initial password').fill('E2eTemp!2345');
    await dlg.getByRole('button', { name: 'Add person' }).click();
    const row = page.locator('tr, li').filter({ hasText: 'e2e-ui-user@e2e.kotu.test' }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });

    await row.getByRole('combobox', { name: 'Role' }).click();
    await page.getByRole('option', { name: 'Warehouse' }).click();
    await expect(row.getByRole('combobox', { name: 'Role' })).toContainText('Warehouse');

    await row.getByRole('button', { name: /Actions for E2E UI User/ }).click();
    await page.getByRole('menuitem', { name: 'Remove' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Remove/ }).click();
    await expect(page.locator('tr, li').filter({ hasText: 'e2e-ui-user@e2e.kotu.test' })).toHaveCount(0, { timeout: 20_000 });
  });

  test('settings: edit the QC checklist and save', async ({ page }) => {
    await page.goto('/settings');
    await settled(page);
    const qc = page.locator('section', { hasText: 'Quality check' }).first();
    await qc.getByPlaceholder(/Add a check/).fill('E2E check item');
    await qc.getByRole('button', { name: 'Add' }).click();
    await qc.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Settings saved').first()).toBeVisible();
    await page.reload();
    await settled(page);
    await expect(page.locator('section', { hasText: 'Quality check' }).first().locator('input[value="E2E check item"]')).toHaveCount(1);
  });
});
