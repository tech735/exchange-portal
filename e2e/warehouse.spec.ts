import { test, expect, loadState, authFile, settled, humanDrag } from './fixtures';
import type { Page } from '@playwright/test';

const state = loadState();
test.use({ storageState: authFile('WAREHOUSE') });
test.describe.configure({ mode: 'serial' });

const column = (page: Page, name: string) => page.locator(`section[aria-label="${name}"]`);
const card = (page: Page, col: string, order: string) => column(page, col).locator('div[draggable]').filter({ hasText: order });

// 1×1 PNG for the QC photo upload
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

test.beforeEach(async ({ page }) => {
  await page.goto('/warehouse');
  await settled(page);
});

test('drag forward books the pickup; Undo on the toast reverts it', async ({ page }) => {
  await humanDrag(page, card(page, 'To book pickup', 'E2E-TEST-1002'), column(page, 'Return in transit'));
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText(/Book return pickup · E2E-TEST-1002/)).toBeVisible();
  await dlg.getByRole('button', { name: /Shiprocket/ }).click();
  await dlg.getByLabel(/AWB number/).fill('E2EAWB1002');
  await dlg.getByRole('button', { name: 'Save booking' }).click();
  await expect(card(page, 'Return in transit', 'E2E-TEST-1002')).toBeVisible();

  await page.getByRole('button', { name: 'Undo' }).first().click();
  await expect(card(page, 'To book pickup', 'E2E-TEST-1002')).toBeVisible();

  // Book it again for the next steps
  await humanDrag(page, card(page, 'To book pickup', 'E2E-TEST-1002'), column(page, 'Return in transit'));
  await dlg.getByRole('button', { name: /iThink/ }).click();
  await dlg.getByLabel(/AWB number/).fill('E2EAWB1002');
  await dlg.getByRole('button', { name: 'Save booking' }).click();
  await expect(card(page, 'Return in transit', 'E2E-TEST-1002')).toBeVisible();
});

test('cancelling the dialog after a drag leaves the card where it was', async ({ page }) => {
  await humanDrag(page, card(page, 'Return in transit', 'E2E-TEST-1003'), column(page, 'Quality check'));
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(card(page, 'Return in transit', 'E2E-TEST-1003')).toBeVisible();
});

test('drag one column back asks first, then undoes the step', async ({ page }) => {
  await humanDrag(page, card(page, 'Return in transit', 'E2E-TEST-1003'), column(page, 'To book pickup'));
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText(/Move E2E-TEST-1003 back/)).toBeVisible();
  await dlg.getByRole('button', { name: 'Move back' }).click();
  await expect(card(page, 'To book pickup', 'E2E-TEST-1003')).toBeVisible();
});

test('a card cannot skip columns', async ({ page }) => {
  await humanDrag(page, card(page, 'To book pickup', 'E2E-TEST-1003'), column(page, 'Ready to ship'));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(card(page, 'To book pickup', 'E2E-TEST-1003')).toBeVisible();
});

test('scan an AWB → received → QC with checklist + photo → approved', async ({ page }) => {
  await page.getByLabel('Scan AWB or order number').fill('E2EAWB1002');
  await page.getByRole('button', { name: 'Find' }).click();
  await expect(page.getByText(/E2E-TEST-1002 received/)).toBeVisible();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText(/Quality check · E2E-TEST-1002/)).toBeVisible();
  const approve = dlg.getByRole('button', { name: 'Approve', exact: true });
  await expect(approve).toBeDisabled(); // checklist not ticked yet
  for (const cb of await dlg.getByRole('checkbox').all()) await cb.click();
  await dlg.locator('input[type=file]').setInputFiles({ name: 'qc.png', mimeType: 'image/png', buffer: PNG });
  await expect(dlg.getByAltText('QC photo 1')).toBeVisible({ timeout: 15_000 });
  await approve.click();
  await expect(card(page, 'Ready to ship', 'E2E-TEST-1002')).toBeVisible();
});

test('QC reject needs a reason; Undo last step on the exchange page reopens QC', async ({ page }) => {
  await card(page, 'Quality check', 'E2E-TEST-1004').getByRole('button', { name: 'Start QC' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('radio', { name: /Reject/ }).click();
  const reject = dlg.getByRole('button', { name: 'Reject return' });
  await expect(reject).toBeDisabled();
  await dlg.getByLabel(/Reason for rejection/).fill('E2E: stain on collar');
  await reject.click();
  await expect(card(page, 'Quality check', 'E2E-TEST-1004')).toHaveCount(0);

  await page.goto(`/exchanges/${state.tickets['E2E-TEST-1004']}`);
  await expect(page.getByText('Rejected at quality check').first()).toBeVisible();
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Undo last step' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Undo step' }).click();
  await expect(page.getByText('QC pending').first()).toBeVisible();
});

test('ship the replacement from Ready to ship', async ({ page }) => {
  await card(page, 'Ready to ship', 'E2E-TEST-1005').getByRole('button', { name: 'Ship replacement' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: /ShipDelight/ }).click();
  await dlg.getByLabel(/AWB number/).fill('E2EAWB1005X');
  await dlg.getByRole('button', { name: 'Save booking' }).click();
  await expect(card(page, 'Shipped (7 days)', 'E2E-TEST-1005')).toBeVisible();
});

test('QC photos are visible on the exchange page', async ({ page }) => {
  await page.goto(`/exchanges/${state.tickets['E2E-TEST-1002']}`);
  await expect(page.getByAltText('QC photo 1')).toBeVisible({ timeout: 15_000 });
});
