import { test, expect } from '@playwright/test';

test.describe('Lakay Ago app smoke tests', () => {
  test('loads the app shell on the home route', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Lakay Ago|Aroo|Management Hub/i);
    await expect(page.locator('body')).toContainText(/Loading account|Sign in to your account/i);
    await expect(page).toHaveURL(/\/|\/dashboard|\/login/i);
  });

  test('keeps the protected route in the app auth flow', async ({ page }) => {
    await page.goto('/employees');

    await expect(page).toHaveURL(/\/employees/i);
    await expect(page.locator('body')).toContainText(/Loading account|Sign in to your account/i);
  });
});
