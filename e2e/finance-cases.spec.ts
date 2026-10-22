import { test, expect, authFile, settled, humanDrag } from './fixtures';
import type { Page } from '@playwright/test';

async function confirmIfAsked(page: Page, label: RegExp) {
  const dlg = page.getByRole('dialog');
  if (await dlg.isVisible().catch(() => false)) await dlg.getByRole('button', { name: label }).click();
}

test.describe('Finance', () => {
  test.use({ storageState: authFile('INVOICING') });

  test('invoice an exchange, close it, and mark a refund as sent', async ({ page }) => {
    await page.goto('/finance');
    await settled(page);
    await expect(page.getByText('Collected this month')).toBeVisible();
    const row = (order: string) => page.locator('table tbody tr').filter({ hasText: order });

    // To invoice → Zoho (blocked in tests) → Mark invoiced
    await row('E2E-TEST-1006').getByRole('button', { name: /Invoice in Zoho/ }).click();
    await row('E2E-TEST-1006').getByRole('button', { name: /Mark invoiced/ }).click();
    await confirmIfAsked(page, /Mark invoiced/);
    await expect(row('E2E-TEST-1006')).toHaveCount(0);

    await page.getByRole('tab', { name: /^Invoiced/ }).click();
    await row('E2E-TEST-1006').getByRole('button', { name: 'Close' }).click();
    await confirmIfAsked(page, /^Close/);
    await expect(row('E2E-TEST-1006')).toHaveCount(0);

    await page.getByRole('tab', { name: /Refunds due/ }).click();
    await row('E2E-TEST-1007').getByRole('button', { name: 'Mark refunded' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Mark refunded' }).click();
    await expect(row('E2E-TEST-1007')).toHaveCount(0);

    const dl = page.waitForEvent('download');
    await page.getByRole('tab', { name: /Completed/ }).click();
    await page.getByRole('button', { name: /Export for Zoho/ }).click();
    expect((await dl).suggestedFilename()).toMatch(/\.csv$/);
  });
});

test.describe('Cases board', () => {
  test.use({ storageState: authFile('SUPPORT') });
  const col = (page: Page, name: string) => page.locator(`section[aria-label="${name}"]`);

  test('drag between columns, open, post an update, resolve; log a case into a column', async ({ page }) => {
    await page.goto('/cases');
    await settled(page);
    await expect(page.getByRole('tab', { name: 'Board', selected: true })).toBeVisible();
    await humanDrag(page, col(page, 'New').getByRole('button', { name: /E2E-TEST-1101/ }), col(page, 'On us'));
    await expect(col(page, 'On us').getByRole('button', { name: /E2E-TEST-1101/ })).toBeVisible();

    await col(page, 'On us').getByRole('button', { name: /E2E-TEST-1101/ }).click();
    await expect(page.getByRole('heading', { name: 'E2E-TEST-1101' })).toBeVisible();
    await page.getByPlaceholder(/Add an update/).fill('E2E: called courier, parcel moving');
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.getByText('E2E: called courier, parcel moving')).toBeVisible();
    await page.getByRole('button', { name: 'Resolve' }).click();
    await expect(page.getByText(/Case resolved/).first()).toBeVisible();

    await page.getByRole('tab', { name: 'Board' }).click();
    await expect(col(page, 'Closed').getByRole('button', { name: /E2E-TEST-1101/ })).toBeVisible();
    await page.getByRole('button', { name: 'Log a case in Waiting on customer' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('Order number').fill('E2E-TEST-1102');
    await dlg.getByLabel('What happened?').fill('E2E: waiting for the customer to confirm address');
    await dlg.getByRole('button', { name: 'Log case' }).click();
    await expect(col(page, 'Waiting on customer').getByRole('button', { name: /E2E-TEST-1102/ })).toBeVisible();

    await page.getByRole('tab', { name: /RTO/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Cases' })).toBeVisible();
  });
});
