import { expect, test } from '@playwright/test';
import { createTag, createTodo, loginAs } from './helpers';

test.describe('Search and filtering', () => {
  test('supports search, combined filters, and preset save/apply/delete', async ({ page }) => {
    const username = `filter_user_${Date.now()}`;
    await loginAs(page, username);

    await createTag(page, { name: 'DeepWork', color: '#2563eb' });
    await createTodo(page, { title: `Write architecture memo ${Date.now()}`, priority: 'high', dueDate: '2099-12-15T11:00' });
    await createTodo(page, { title: `Buy milk ${Date.now()}`, priority: 'low', dueDate: '2099-12-20T11:00' });

    const assignStatus = await page.evaluate(async () => {
      const todosResponse = await fetch('/api/todos');
      const todosBody = await todosResponse.json();
      const tagsResponse = await fetch('/api/tags');
      const tagsBody = await tagsResponse.json();

      const todo = (todosBody.data ?? []).find((item: { title: string }) => item.title.includes('Write architecture memo'));
      const tag = (tagsBody.data ?? []).find((item: { name: string }) => item.name === 'DeepWork');
      if (!todo || !tag) {
        return 0;
      }

      const response = await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_ids: [tag.id] }),
      });

      return response.status;
    });

    expect(assignStatus).toBe(200);
    await page.reload();

    await page.getByLabel('Todo search').fill('architecture');
    await page.getByLabel('Priority filter').selectOption('high');
    await page.getByLabel('Tag filter').selectOption({ label: 'DeepWork' });
    await page.getByRole('button', { name: 'Advanced' }).click();
    await page.getByLabel('Completion filter').selectOption('active');

    await expect(page.getByText('Write architecture memo')).toBeVisible();
    await expect(page.getByText('Buy milk')).toHaveCount(0);

    await page.getByLabel('Preset name').fill('focus-mode');
    await page.getByRole('button', { name: 'Save Preset' }).click();
    await expect(page.getByRole('button', { name: 'focus-mode', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Clear All' }).click();
    await page.getByRole('button', { name: 'focus-mode', exact: true }).click();
    await expect(page.getByText('Write architecture memo')).toBeVisible();

    await page.getByLabel('Delete preset focus-mode').click();
    await expect(page.getByRole('button', { name: 'focus-mode' })).toHaveCount(0);
  });
});
