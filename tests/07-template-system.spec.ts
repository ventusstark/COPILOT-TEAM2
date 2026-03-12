import { expect, test } from '@playwright/test';
import { createTodo, loginAs } from './helpers';

test.describe('Template system', () => {
  test('save, use, and delete a template', async ({ page }) => {
    const username = `template_user_${Date.now()}`;
    const baseTitle = `Template base ${Date.now()}`;

    await loginAs(page, username);
    await createTodo(page, {
      title: baseTitle,
      priority: 'high',
      dueDate: '2099-12-31T10:00',
    });

    const templateStatus = await page.evaluate(async ({ title }) => {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Morning Routine',
          description: 'Daily kickoff',
          category: 'routine',
          title_template: title,
          priority: 'high',
          recurrence_enabled: false,
          reminder_minutes: null,
        }),
      });

      return response.status;
    }, { title: baseTitle });

    expect(templateStatus).toBe(201);

    await page.getByRole('button', { name: 'Templates' }).click();
    await expect(page.getByText('Morning Routine')).toBeVisible();
    await page.getByRole('button', { name: 'Use' }).first().click();
    await page.getByRole('button', { name: 'Close' }).click();

    await expect(page.getByText(baseTitle)).toHaveCount(2);

    await page.getByRole('button', { name: 'Templates' }).click();
    await page.getByRole('button', { name: 'Delete' }).first().click();
    await page.getByRole('button', { name: 'Close' }).click();

    await expect(page.getByText(baseTitle)).toHaveCount(2);
  });
});
