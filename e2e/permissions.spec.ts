import { test, expect, authFile, settled } from './fixtures';
import type { Page } from '@playwright/test';

// Changes the live role_permissions setting, so it only ever grants something
// harmless (Finance → Shipments) and resets to defaults before it ends.
// cleanup.mjs also restores app_settings to its pre-run state.
const denied = /This page isn’t part of your role/;
test.use({ storageState: authFile('ADMIN') });

async function openPermissions(page: Page) {
  await page.goto('/users');
  await settled(page);
  await page.getByRole('tab', { name: 'Roles & permissions' }).click();
  await expect(page).toHaveURL(/\/users\?tab=permissions/);
  await expect(page.getByRole('heading', { name: 'Roles & permissions' })).toBeVisible();
}

const box = (page: Page, name: string) => page.getByRole('checkbox', { name: new RegExp(`^${name}`) });

test('matrix shows locked cells and dependent permissions', async ({ page }) => {
  await openPermissions(page);
  await expect(box(page, 'Admin: Finance')).toBeChecked();
  await expect(box(page, 'Admin: Finance')).toBeDisabled();
  await expect(box(page, 'Support: Dashboard')).toBeDisabled();
  await expect(box(page, 'Support: Users & roles, Settings')).not.toBeChecked();
  await expect(box(page, 'Support: Users & roles, Settings')).toBeDisabled();
  // Details come with the Exchanges page; deleting needs the Exchanges page
  await expect(box(page, 'Support: Open exchange details')).toBeDisabled();
  await expect(box(page, 'Warehouse: Delete exchanges')).toBeDisabled();
  await expect(box(page, 'Warehouse: Open exchange details')).toBeEnabled();
});

test('edits can be discarded without saving', async ({ page }) => {
  await openPermissions(page);
  await box(page, 'Warehouse: Finance').click();
  await expect(page.getByText('Unsaved permission changes')).toBeVisible();
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByText('Unsaved permission changes')).toHaveCount(0);
  await expect(box(page, 'Warehouse: Finance')).not.toBeChecked();
});

test('granting a page takes effect for that role, and reset restores defaults', async ({ page, browser }) => {
  test.setTimeout(90_000);
  const finance = await browser.newContext({ storageState: authFile('INVOICING') });
  const fp = await finance.newPage();
  try {
    await fp.goto('/shipments');
    await expect(fp.getByText(denied)).toBeVisible();

    await openPermissions(page);
    await box(page, 'Finance: Shipments').click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Permissions saved').first()).toBeVisible();
    // The People tab summary follows the saved permissions
    await page.getByRole('tab', { name: /^People/ }).click();
    await expect(page.locator('li', { hasText: 'Collects payments' }).getByText('Shipments', { exact: true })).toBeVisible();

    await fp.goto('/shipments');
    await expect(fp.getByRole('heading', { level: 1, name: 'Shipments' })).toBeVisible();
    await expect(fp.getByText(denied)).toHaveCount(0);
    await expect(fp.getByRole('navigation', { name: 'Main' }).first().getByRole('link', { name: /^Shipments/ })).toBeVisible();
  } finally {
    await openPermissions(page);
    const reset = page.getByRole('button', { name: /Reset to defaults/ });
    if (await reset.isEnabled()) {
      await reset.click();
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.getByText('Permissions saved').first()).toBeVisible();
    }
  }

  await fp.goto('/shipments');
  await expect(fp.getByText(denied)).toBeVisible();
  await finance.close();
});
