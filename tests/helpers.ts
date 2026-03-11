import type { Page } from '@playwright/test';

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