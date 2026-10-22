import { test, expect, loadState, signIn, authFile, type Role } from './fixtures';

const state = loadState();

test('warm up: app loads', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/login', { timeout: 90_000 });
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible({ timeout: 90_000 });
});

test('wrong password shows a clear inline error', async ({ page, consoleErrors }) => {
  await signIn(page, state.users.SUPPORT.email, 'definitely-wrong-password');
  await expect(page.getByText(/Incorrect email or password/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  // The 400 from Supabase and the app's own log of it are expected here.
  const keep = consoleErrors.filter((e) => !/status of 400|Invalid login credentials/.test(e));
  consoleErrors.splice(0, consoleErrors.length, ...keep);
});

test('signed-out users are sent to login', async ({ page }) => {
  await page.goto('/exchanges');
  await expect(page).toHaveURL(/\/login/);
});

for (const role of ['ADMIN', 'SUPPORT', 'WAREHOUSE', 'INVOICING'] as Role[]) {
  test(`sign in as ${role}`, async ({ page }) => {
    const u = state.users[role];
    const t0 = Date.now();
    await signIn(page, u.email, u.password);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Good (morning|afternoon|evening)/);
    test.info().annotations.push({ type: 'timing', description: `${role} login → dashboard ${Date.now() - t0} ms` });
    await page.context().storageState({ path: authFile(role) });
  });
}
