import { expect, test } from '@playwright/test';
import { createTodoWithReminder, loginAs } from './helpers';

function futureIso(minutesFromNow: number): string {
  return new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
}

test.describe('Reminder notifications', () => {
  test('notification check requires authentication', async ({ request }) => {
    const response = await request.get('/api/notifications/check');

    expect(response.status()).toBe(401);
  });

  test('reminder selector is disabled until due date exists', async ({ page }) => {
    await loginAs(page, `reminder_disabled_${Date.now()}`);

    await expect(page.getByLabel('Todo reminder')).toBeDisabled();
    await page.getByLabel('Todo due date').fill('2099-12-31T10:00');
    await expect(page.getByLabel('Todo reminder')).toBeEnabled();
  });

  test('create todo rejects reminder without due date', async ({ page }) => {
    await loginAs(page, `reminder_requires_due_${Date.now()}`);

    const response = await page.evaluate(async () => {
      const result = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Reminder without due ${Date.now()}`,
          reminder_minutes: 30,
        }),
      });

      return {
        status: result.status,
        body: await result.json(),
      };
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Reminder requires a due date');
  });

  test('todo shows reminder badge after create', async ({ page }) => {
    const title = `Reminder badge ${Date.now()}`;

    await loginAs(page, `reminder_badge_${Date.now()}`);
    await createTodoWithReminder(page, {
      title,
      dueDate: '2099-12-31T10:00',
      reminderMinutes: 60,
    });

    const todoItem = page.locator('li').filter({ hasText: title });
    await expect(todoItem.getByText('1h', { exact: true })).toBeVisible();
  });

  test('clearing due date while editing clears reminder selection', async ({ page }) => {
    const title = `Reminder clear ${Date.now()}`;

    await loginAs(page, `reminder_clear_${Date.now()}`);
    await createTodoWithReminder(page, {
      title,
      dueDate: '2099-12-31T11:00',
      reminderMinutes: 30,
    });

    const todoItem = page.locator('li').filter({ hasText: title });
    await todoItem.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Edit due date').fill('');
    await expect(page.getByLabel('Edit reminder')).toBeDisabled();
    await expect(page.getByLabel('Edit reminder')).toHaveValue('');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(todoItem.getByText('30m', { exact: true })).toHaveCount(0);
  });

  test('notification check returns due reminders only once', async ({ page }) => {
    const title = `Reminder due once ${Date.now()}`;

    await loginAs(page, `reminder_once_${Date.now()}`);
    const createResponse = await page.evaluate(async ({ todoTitle, dueDate }) => {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: todoTitle,
          due_date: dueDate,
          reminder_minutes: 15,
        }),
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    }, {
      todoTitle: title,
      dueDate: futureIso(2),
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.reminder_minutes).toBe(15);

    const firstCheck = await page.evaluate(async () => {
      const response = await fetch('/api/notifications/check');
      return {
        status: response.status,
        body: await response.json(),
      };
    });
    expect(firstCheck.status).toBe(200);
    expect(firstCheck.body.data).toHaveLength(1);
    expect(firstCheck.body.data[0].title).toBe(title);

    const secondCheck = await page.evaluate(async () => {
      const response = await fetch('/api/notifications/check');
      return {
        status: response.status,
        body: await response.json(),
      };
    });
    expect(secondCheck.status).toBe(200);
    expect(secondCheck.body.data).toHaveLength(0);
  });

  test('notification button reflects granted permission state', async ({ context, page }) => {
    await context.grantPermissions(['notifications']);
    await page.addInitScript(() => {
      class MockNotification {
        static permission = 'granted';

        static async requestPermission() {
          return 'granted';
        }

        constructor(_title: string, _options?: NotificationOptions) {}
      }

      Object.defineProperty(window, 'Notification', {
        configurable: true,
        writable: true,
        value: MockNotification,
      });
    });

    await loginAs(page, `reminder_permission_${Date.now()}`);
    await expect(page.getByRole('button', { name: 'Notifications Enabled' })).toBeVisible();
  });
});