import { expect, test } from '@playwright/test';
import { createTodo, loginAs } from './helpers';

test.describe('Todo CRUD operations', () => {
  test('create todo with title only', async ({ page }) => {
    const title = `Buy groceries ${Date.now()}`;
    await loginAs(page, 'crud_user_title_only');
    await createTodo(page, { title });
    await expect(page.getByText(title)).toBeVisible();
  });

  test('create todo with priority and due date', async ({ page }) => {
    const title = `Prepare sprint demo ${Date.now()}`;
    await loginAs(page, 'crud_user_with_metadata');
    await createTodo(page, {
      title,
      priority: 'high',
      dueDate: '2099-12-31T20:00',
    });

    await expect(page.getByText(title)).toBeVisible();
    await expect(
      page.locator('li').filter({ hasText: title }).getByText('high', { exact: true }),
    ).toBeVisible();
  });

  test('edit, complete, and delete todo', async ({ page }) => {
    const originalTitle = `Draft release notes ${Date.now()}`;
    const updatedTitle = `${originalTitle} v2`;
    await loginAs(page, 'crud_user_edit_complete_delete');
    await createTodo(page, { title: originalTitle, priority: 'low' });

    const todoItem = page.locator('li').filter({ hasText: originalTitle });
    await todoItem.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Edit title').fill(updatedTitle);
    await page.getByLabel('Edit priority').selectOption('high');
    await page.getByLabel('Edit due date').fill('2099-12-31T21:00');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText(updatedTitle)).toBeVisible();
    await expect(
      page.locator('li').filter({ hasText: updatedTitle }).getByText('high', { exact: true }),
    ).toBeVisible();

    await page.locator('li').filter({ hasText: updatedTitle }).getByRole('button', { name: 'Complete' }).click();
    await expect(page.getByText('Completed (1)')).toBeVisible();

    await page.locator('li').filter({ hasText: updatedTitle }).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(updatedTitle)).toHaveCount(0);
  });

  test('rejects empty title', async ({ page }) => {
    await loginAs(page, 'crud_user_empty_title');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('Title is required')).toBeVisible();
  });

  test('rejects past due date', async ({ page }) => {
    await loginAs(page, 'crud_user_past_due');
    await page.getByLabel('Todo title').fill(`Past due validation ${Date.now()}`);
    await page.getByLabel('Todo due date').fill('2000-01-01T10:00');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('Due date must be at least 1 minute in the future')).toBeVisible();
  });

  test('unauthorized APIs return 401', async ({ request }) => {
    const unauthGet = await request.get('/api/todos');
    const unauthPost = await request.post('/api/todos', {
      data: { title: 'Should not be created' },
    });
    const unauthPut = await request.put('/api/todos/1', {
      data: { title: 'Nope' },
    });
    const unauthDelete = await request.delete('/api/todos/1');

    expect(unauthGet.status()).toBe(401);
    expect(unauthPost.status()).toBe(401);
    expect(unauthPut.status()).toBe(401);
    expect(unauthDelete.status()).toBe(401);
  });
});