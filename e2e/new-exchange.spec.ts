import { test, expect, loadState, authFile, settled } from './fixtures';

const state = loadState();
test.use({ storageState: authFile('SUPPORT') });

test('manual entry: phone call request, catalogue item, replacement size, decide payment later', async ({ page }) => {
  const t0 = Date.now();
  await page.goto('/exchanges/new');
  await expect(page.getByRole('heading', { name: 'New exchange' })).toBeVisible();
  const lodge = page.getByRole('button', { name: /Lodge exchange/ });
  await expect(lodge).toBeDisabled();

  await page.getByRole('radio', { name: 'Phone call' }).click();
  await page.getByRole('button', { name: /Enter details manually/ }).click();
  await page.getByLabel('Order number').fill('E2E-TEST-2002');
  await page.getByLabel('Customer name').fill('E2E Manual Customer');
  await page.getByLabel('Phone').fill('9000002002');

  // Item coming back, from the catalogue
  await page.getByRole('combobox').filter({ hasText: 'Search product or SKU' }).click();
  await page.getByPlaceholder('Search product or SKU…').last().fill(state.products.single.name);
  await page.getByRole('option', { name: new RegExp(state.products.single.name) }).first().click();
  await page.getByRole('radiogroup', { name: 'Size' }).first().getByRole('radio', { name: state.products.single.sizes[0].size, exact: true }).click();
  await page.getByRole('button', { name: 'Add item' }).click();

  // Replacement: a different size, picked from the size buttons
  const replace = page.locator('section', { hasText: 'What should we send instead?' });
  await expect(replace.getByText(/Replacing/)).toBeVisible();
  await replace.getByRole('radio', { name: state.products.single.sizes[1].size, exact: true }).click();
  await expect(replace.getByText(/^Selected/)).toBeVisible();

  await page.getByRole('radio', { name: /Decide later/ }).click();
  await expect(lodge).toBeEnabled();
  await lodge.click();
  await expect(page).toHaveURL(/\/exchanges\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('E2E-TEST-2002');
  await expect(page.getByText('via Phone call')).toBeVisible();
  test.info().annotations.push({ type: 'timing', description: `manual exchange lodged in ${Date.now() - t0} ms (incl. typing)` });
});

test('Shopify order: lookup, eligibility, grouped size picker, change product, already paid', async ({ page }) => {
  const g = state.products.grouped;
  const [cur, next] = g.sizes;
  // The Shopify lookup is mocked with a test order so no real order is used.
  await page.route('**/functions/v1/shopify', async (route) => {
    const body = route.request().postDataJSON?.() ?? {};
    if (body.action !== 'getOrder') return route.continue();
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ order: {
        id: 9900001, name: '#E2E-TEST-2001', email: 'shopify2001@e2e.kotu.test', phone: '+919000002001',
        customer: { first_name: 'E2E', last_name: 'Shopify 👸', email: 'shopify2001@e2e.kotu.test', phone: '+919000002001' },
        line_items: [{ id: 1, product_id: 1, variant_id: 1, title: g.name, quantity: 1, price: String(cur.price), sku: cur.sku, variant_title: cur.size, name: `${g.name} - ${cur.size}`, fulfillable_quantity: 0, tax_lines: [] }],
        total_price: String(cur.price), subtotal_price: String(cur.price), total_tax: '0', currency: 'INR', financial_status: 'paid', fulfillment_status: 'fulfilled',
        created_at: new Date(Date.now() - 3 * 864e5).toISOString(),
        fulfillments: [{ tracking_company: 'Delhivery', tracking_number: 'E2ESHOP1', tracking_url: '', status: 'success', location_id: 1, created_at: new Date(Date.now() - 2 * 864e5).toISOString() }],
      } }),
    });
  });

  await page.goto('/exchanges/new');
  await page.getByRole('radio', { name: 'Email' }).click();
  await page.getByLabel('Shopify order').fill('E2E-TEST-2001');
  await page.getByRole('button', { name: 'Find' }).click();
  await expect(page.getByText(/Eligible · \d+d left/)).toBeVisible();
  // Emoji from Shopify is stripped from the name
  await expect(page.getByLabel('Customer name')).toHaveValue('E2E Shopify');

  const replace = page.locator('section', { hasText: 'What should we send instead?' });
  // Two-step picker: group row is pre-selected to the returned item's group
  const group = cur.size.split(' / ')[0];
  const groupRow = replace.getByRole('radiogroup').first();
  await expect(groupRow.getByRole('radio', { name: new RegExp(`^${group}`) })).toHaveAttribute('aria-checked', 'true');
  const nextGroup = next.size.split(' / ')[0];
  if (nextGroup !== group) await groupRow.getByRole('radio', { name: new RegExp(`^${nextGroup}`) }).click();
  await replace.getByRole('radiogroup', { name: 'Size' }).getByRole('radio', { name: next.size.split(' / ').slice(1).join(' / '), exact: true }).click();
  await expect(replace.getByText(new RegExp(`Selected ${next.size.replace(/[/()+]/g, '.')}`))).toBeVisible();

  // Change product sits next to the product, and can be undone
  await replace.getByRole('button', { name: /Change product/ }).click();
  await expect(replace.getByRole('combobox')).toBeVisible();
  await replace.getByRole('button', { name: /Same product/ }).click();
  await replace.getByRole('radiogroup', { name: 'Size' }).getByRole('radio', { name: next.size.split(' / ').slice(1).join(' / '), exact: true }).click();

  await page.getByRole('radio', { name: /Already paid/ }).click();
  await page.getByRole('button', { name: /Lodge exchange/ }).click();
  await expect(page).toHaveURL(/\/exchanges\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  await settled(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('E2E-TEST-2001');
  await expect(page.getByText('To book pickup').first()).toBeVisible();
  await expect(page.getByText('via Email')).toBeVisible();
});

test('lodge stays disabled and says what is missing', async ({ page }) => {
  await page.goto('/exchanges/new');
  await expect(page.getByText(/Still needed: how the customer reached us/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Lodge exchange/ })).toBeDisabled();
});
