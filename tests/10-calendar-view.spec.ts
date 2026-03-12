import { expect, test } from '@playwright/test';
import { createTodo, loginAs } from './helpers';

test.describe('Calendar view', () => {
  test('shows month navigation and due-date placement', async ({ page }) => {
    const username = `calendar_user_${Date.now()}`;
    const title = `Calendar todo ${Date.now()}`;
    const nearFuture = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const dueDateLocal = `${nearFuture.getFullYear()}-${String(nearFuture.getMonth() + 1).padStart(2, '0')}-${String(nearFuture.getDate()).padStart(2, '0')}T09:00`;

    await loginAs(page, username);
    await createTodo(page, {
      title,
      priority: 'high',
      dueDate: dueDateLocal,
    });

    await page.getByRole('link', { name: 'Calendar' }).click();
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();

    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Previous' }).click();

    await expect(page.getByText(title)).toBeVisible();
  });
});
