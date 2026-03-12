import { test, expect } from '@playwright/test';
import { registerWithWebAuthn, loginAs } from './helpers';

test.describe('WebAuthn Authentication', () => {
  test('should redirect unauthenticated user away from protected routes', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/calendar');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should register a new user with WebAuthn', async ({ page }) => {
    await registerWithWebAuthn(page, `testuser_${Date.now()}`);

    // Verify we're on the home page
    await expect(page).toHaveURL('/');

    // Verify we're logged in (should see todo interface, not login page)
    const todoInput = page.getByLabel('Todo title');
    await expect(todoInput).toBeVisible();
  });

  test('should reject duplicate username during registration', async ({ page }) => {
    const username = `duplicate_${Date.now()}`;
    
    // Register first user
    await registerWithWebAuthn(page, username);
    await page.goto('/login');

    // Try to register with same username
    await page.goto('/register');
    await page.getByLabel('Username').fill(username);
    await page.getByRole('button', { name: 'Register with Passkey' }).click();

    // Should show error
    const errorMessage = page.getByText(/username already registered/i);
    await expect(errorMessage).toBeVisible();
  });

  test('should login with registered passkey', async ({ page }) => {
    const username = `logintest_${Date.now()}`;
    
    // Register user
    await registerWithWebAuthn(page, username);

    // Logout
    const logoutButton = page.getByRole('button', { name: /logout/i });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await page.waitForURL('/login');
    }

    // Login with same credentials (loginAs will either register or login)
    await loginAs(page, username);

    // Verify we're on home page
    await expect(page).toHaveURL('/');
    const todoInput = page.getByLabel('Todo title');
    await expect(todoInput).toBeVisible();
  });

  test('should redirect to login when session expires', async ({ page }) => {
    const username = `sessiontest_${Date.now()}`;
    
    // Register and login
    await registerWithWebAuthn(page, username);

    // Clear cookies manually (simulating session expiry)
    await page.context().clearCookies();

    // Try to access home page
    await page.goto('/');

    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });

  test('should allow access to calendar after login', async ({ page }) => {
    const username = `calendartest_${Date.now()}`;
    
    // Register and login
    await registerWithWebAuthn(page, username);

    // Navigate to calendar
    await page.goto('/calendar');

    // Should not redirect, calendar should be visible
    await expect(page).toHaveURL('/calendar');
  });

  test('authenticated user can logout', async ({ page }) => {
    const username = `logouttest_${Date.now()}`;
    
    // Register and login
    await registerWithWebAuthn(page, username);

    // Find and click logout button
    const logoutButton = page.getByRole('button', { name: /logout/i });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await page.waitForURL('/login');
    }

    await expect(page).toHaveURL(/\/login/);
  });

  test('should handle missing username on registration', async ({ page }) => {
    await page.goto('/register');

    // Try to submit without entering username
    await page.getByRole('button', { name: 'Register with Passkey' }).click();

    // Should show error about username
    const errorMessage = page.getByText(/username is required/i);
    await expect(errorMessage).toBeVisible();
  });

  test('should allow creating todos after login', async ({ page }) => {
    const username = `todotest_${Date.now()}`;
    
    // Register and login
    await registerWithWebAuthn(page, username);

    // Create a todo
    const todoInput = page.getByLabel('Todo title');
    await todoInput.fill('Test Todo');
    await page.getByRole('button', { name: /add/i }).click();

    // Verify todo is created (should appear in the list)
    await expect(page.getByText('Test Todo')).toBeVisible();
  });
});
