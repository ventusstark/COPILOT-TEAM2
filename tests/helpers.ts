import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export async function loginAs(page: Page, username: string): Promise<void> {
  await page.goto('/login');
  const response = await page.evaluate(async (selectedUsername) => {
    const result = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: selectedUsername }),
    });

    return {
      status: result.status,
      body: await result.json(),
    };
  }, username);

  if (response.status !== 200) {
    throw new Error(`Login failed for ${username}: ${response.body?.error ?? 'unknown error'}`);
  }

  await page.goto('/');
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