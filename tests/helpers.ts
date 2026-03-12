import type { BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export async function registerWithWebAuthn(
  page: Page,
  username: string,
): Promise<void> {
  const context = page.context();
  
  // Enable virtual authenticator if not already enabled
  try {
    await (context as any).addVirtualAuthenticator({
      protocol: 'ctap2',
      hasResidentKey: true,
      hasUserVerification: true,
    });
  } catch {
    // Authenticator may already be added, that's fine
  }

  // Navigate to registration
  await page.goto('/register');

  // Fill username
  await page.getByLabel('Username').fill(username);

  // Click register button
  await page.getByRole('button', { name: 'Register with Passkey' }).click();

  // Wait for navigation to home page
  await page.waitForURL('/');
}

export async function loginAs(
  page: Page,
  username: string,
): Promise<void> {
  const context = page.context();

  // Enable virtual authenticator if not already enabled
  try {
    await (context as any).addVirtualAuthenticator({
      protocol: 'ctap2',
      hasResidentKey: true,
      hasUserVerification: true,
    });
  } catch {
    // Authenticator may already be added, that's fine
  }

  // First check if user exists, if not register
  await page.goto('/login');
  
  // Check if user is already registered (try to fill username and submit login)
  const usernameInput = page.getByLabel('Username');
  await usernameInput.fill(username);
  
  // Try clicking login button
  try {
    await page.getByRole('button', { name: 'Login with Passkey' }).click();
    
    // If login succeeds, we're done
    await page.waitForURL('/', { timeout: 5000 });
  } catch {
    // User not registered, need to register first
    await page.goto('/register');
    await page.getByLabel('Username').fill(username);
    await page.getByRole('button', { name: 'Register with Passkey' }).click();
    await page.waitForURL('/');
  }
}

export async function createTodo(page: Page, input: {
  title: string;
  priority?: 'high' | 'medium' | 'low';
  dueDate?: string;
}): Promise<void> {
  await page.getByLabel('Todo title').fill(input.title);

  if (input.priority) {
    await page.getByLabel('Todo priority').selectOption(input.priority);
  }

  if (input.dueDate) {
    await page.getByLabel('Todo due date').fill(input.dueDate);
  }

  await page.getByRole('button', { name: 'Add' }).click();
}

export async function createTodoWithReminder(page: Page, input: {
  title: string;
  dueDate: string;
  reminderMinutes: number;
  priority?: 'high' | 'medium' | 'low';
}): Promise<void> {
  await page.getByLabel('Todo title').fill(input.title);

  if (input.priority) {
    await page.getByLabel('Todo priority').selectOption(input.priority);
  }

  await page.getByLabel('Todo due date').fill(input.dueDate);
  await page.getByLabel('Todo reminder').selectOption(String(input.reminderMinutes));
  await page.getByRole('button', { name: 'Add' }).click();
}

export async function createTag(page: Page, input: {
  name: string;
  color: string;
}): Promise<void> {
  await page.getByRole('button', { name: 'Manage Tags' }).click();
  await page.getByLabel('Tag name').fill(input.name);
  await page.getByLabel('Tag color hex').fill(input.color);
  await page.getByRole('button', { name: 'Add', exact: true }).nth(1).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('button', { name: input.name }).first()).toBeVisible();
}

export async function saveTemplateFromForm(page: Page, input: {
  templateName: string;
  description?: string;
  category?: string;
}): Promise<void> {
  await page.getByRole('button', { name: 'Save as Template' }).click();
  await page.getByLabel('Template name').fill(input.templateName);
  if (input.description) {
    await page.getByLabel('Template description').fill(input.description);
  }
  if (input.category) {
    await page.getByLabel('Template category').fill(input.category);
  }
  await page.getByRole('button', { name: 'Save', exact: true }).click();
}