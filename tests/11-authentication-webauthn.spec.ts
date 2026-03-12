import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Authentication and protection', () => {
  test('redirects unauthenticated user away from protected routes', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/calendar');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page exposes username sign-in flow', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('authenticated user can logout', async ({ page }) => {
    await loginAs(page, `auth_logout_${Date.now()}`);
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
