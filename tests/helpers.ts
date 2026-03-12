import type { Locator, Page } from '@playwright/test';

export async function loginAs(page: Page, username: string): Promise<void> {
  const response = await page.request.post('/api/auth/login', {
    data: { username },
  });

  if (!response.ok()) {
    throw new Error(`Login failed for ${username}`);
  }

  const setCookieHeader = response.headers()['set-cookie'];
  const token = setCookieHeader?.match(/todo_session=([^;]+)/)?.[1];
  if (!token) {
    throw new Error('Session cookie not found in login response');
  }

  await page.context().addCookies([
    {
      name: 'todo_session',
      value: token,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);

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

export function getTodoItem(page: Page, title: string): Locator {
  return page.locator('li').filter({ hasText: title }).first();
}

export async function openSubtasks(todoItem: Locator): Promise<void> {
  await todoItem.getByRole('button', { name: /Subtasks/ }).click();
}

export async function addSubtask(todoItem: Locator, title: string): Promise<void> {
  await todoItem.getByLabel('Subtask title').fill(title);
  await todoItem.getByRole('button', { name: 'Add subtask' }).click();
}

export async function toggleSubtask(todoItem: Locator, title: string): Promise<void> {
  await todoItem.getByLabel(`Toggle subtask ${title}`).click();
}

export async function deleteSubtask(todoItem: Locator, title: string): Promise<void> {
  const row = todoItem.locator('li').filter({ hasText: title }).first();
  await row.getByRole('button', { name: 'Delete subtask' }).click();
}