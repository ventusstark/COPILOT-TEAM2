import { expect, test } from '@playwright/test';
import { createTodo, loginAs } from './helpers';

test.describe('Export and import', () => {
  test('exports JSON/CSV and imports JSON backup', async ({ page }) => {
    const username = `export_user_${Date.now()}`;
    const title = `Exportable todo ${Date.now()}`;

    await loginAs(page, username);
    await createTodo(page, {
      title,
      priority: 'high',
      dueDate: '2099-12-31T10:00',
    });

    const jsonExport = await page.evaluate(async () => {
      const response = await fetch('/api/todos/export?format=json');
      const body = await response.json();
      return { status: response.status, body };
    });
    expect(jsonExport.status).toBe(200);
    expect(jsonExport.body.data.todos.length).toBeGreaterThan(0);

    const csvExport = await page.evaluate(async () => {
      const response = await fetch('/api/todos/export?format=csv');
      const text = await response.text();
      return { status: response.status, text };
    });
    expect(csvExport.status).toBe(200);
    expect(csvExport.text).toContain('title,priority,due_date');

    const importResult = await page.evaluate(async ({ data }) => {
      const response = await fetch('/api/todos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todos: data.todos }),
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    }, { data: jsonExport.body.data });

    expect(importResult.status).toBe(200);
    expect(importResult.body.data.imported).toBeGreaterThan(0);

    await page.reload();
    await expect(page.getByText(title)).toHaveCount(2);
  });

  test('rejects invalid import payload', async ({ page }) => {
    await loginAs(page, `import_invalid_${Date.now()}`);

    const response = await page.evaluate(async () => {
      const result = await fetch('/api/todos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: true }),
      });
      return {
        status: result.status,
        body: await result.json(),
      };
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid import format');
  });
});
