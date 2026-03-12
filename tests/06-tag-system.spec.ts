import { expect, test } from '@playwright/test';
import { createTag, createTodo, loginAs } from './helpers';

test.describe('Tag system', () => {
  test('create, assign, filter, and delete tags', async ({ page }) => {
    const username = `tag_user_${Date.now()}`;
    const todoTitle = `Tagged todo ${Date.now()}`;

    await loginAs(page, username);
    await createTag(page, { name: 'Work', color: '#ef4444' });

    await createTodo(page, { title: todoTitle });
    const assignStatus = await page.evaluate(async ({ expectedTitle }) => {
      const todosResponse = await fetch('/api/todos');
      const todosBody = await todosResponse.json();
      const tagsResponse = await fetch('/api/tags');
      const tagsBody = await tagsResponse.json();

      const todo = (todosBody.data ?? []).find((item: { title: string }) => item.title === expectedTitle);
      const tag = (tagsBody.data ?? []).find((item: { name: string }) => item.name === 'Work');
      if (!todo || !tag) {
        return 0;
      }

      const response = await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_ids: [tag.id] }),
      });

      return response.status;
    }, { expectedTitle: todoTitle });

    expect(assignStatus).toBe(200);
    await page.reload();

    const todoItem = page.locator('li').filter({ hasText: todoTitle });

    await expect(todoItem.getByText('Work')).toBeVisible();

    await page.getByLabel('Tag filter').selectOption({ label: 'Work' });
    await expect(page.getByText(todoTitle)).toBeVisible();

    await page.getByRole('button', { name: 'Manage Tags' }).click();
    await page.locator('div').filter({ hasText: /^Work#ef4444/i }).getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Close' }).click();

    await expect(page.getByText('Work')).toHaveCount(0);
  });
});
