import { expect, test } from '@playwright/test';
import {
  addSubtask,
  createTodo,
  deleteSubtask,
  getTodoItem,
  loginAs,
  openSubtasks,
  toggleSubtask,
} from './helpers';

test.describe('Subtasks and progress tracking', () => {
  test('adds subtasks and keeps progress visible when collapsed', async ({ page }) => {
    const title = `Subtask add flow ${Date.now()}`;

    await loginAs(page, `subtask_add_${Date.now()}`);
    await createTodo(page, { title });

    const todoItem = getTodoItem(page, title);
    await expect(todoItem.getByText('0/0 subtasks', { exact: true })).toBeVisible();

    await openSubtasks(todoItem);
    await addSubtask(todoItem, 'Draft outline');
    await addSubtask(todoItem, 'Review checklist');

    await expect(todoItem.getByText('Draft outline', { exact: true })).toBeVisible();
    await expect(todoItem.getByText('Review checklist', { exact: true })).toBeVisible();
    await expect(todoItem.getByText('0/2 subtasks', { exact: true })).toBeVisible();
    await expect(todoItem.getByText('0%', { exact: true })).toBeVisible();

    await todoItem.getByRole('button', { name: 'Hide Subtasks' }).click();
    await expect(todoItem.getByText('0/2 subtasks', { exact: true })).toBeVisible();
    await expect(todoItem.getByText('0%', { exact: true })).toBeVisible();
  });

  test('updates percentage and count when subtasks are toggled', async ({ page }) => {
    const title = `Subtask toggle flow ${Date.now()}`;

    await loginAs(page, `subtask_toggle_${Date.now()}`);
    await createTodo(page, { title });

    const todoItem = getTodoItem(page, title);
    await openSubtasks(todoItem);
    await addSubtask(todoItem, 'Item A');
    await addSubtask(todoItem, 'Item B');

    await toggleSubtask(todoItem, 'Item A');
    await expect(todoItem.getByText('1/2 subtasks', { exact: true })).toBeVisible();
    await expect(todoItem.getByText('50%', { exact: true })).toBeVisible();

    await toggleSubtask(todoItem, 'Item B');
    await expect(todoItem.getByText('2/2 subtasks', { exact: true })).toBeVisible();
    await expect(todoItem.getByText('100%', { exact: true })).toBeVisible();

    await toggleSubtask(todoItem, 'Item A');
    await expect(todoItem.getByText('1/2 subtasks', { exact: true })).toBeVisible();
    await expect(todoItem.getByText('50%', { exact: true })).toBeVisible();

    await expect(todoItem.getByRole('button', { name: 'Complete' })).toBeVisible();
  });

  test('recalculates progress when subtasks are deleted', async ({ page }) => {
    const title = `Subtask delete flow ${Date.now()}`;

    await loginAs(page, `subtask_delete_${Date.now()}`);
    await createTodo(page, { title });

    const todoItem = getTodoItem(page, title);
    await openSubtasks(todoItem);
    await addSubtask(todoItem, 'Completed task');
    await addSubtask(todoItem, 'Remaining task');

    await toggleSubtask(todoItem, 'Completed task');
    await expect(todoItem.getByText('1/2 subtasks', { exact: true })).toBeVisible();

    await deleteSubtask(todoItem, 'Completed task');
    await expect(todoItem.getByText('0/1 subtasks', { exact: true })).toBeVisible();
    await expect(todoItem.getByText('0%', { exact: true })).toBeVisible();

    await deleteSubtask(todoItem, 'Remaining task');
    await expect(todoItem.getByText('0/0 subtasks', { exact: true })).toBeVisible();
    await expect(todoItem.getByText('0%', { exact: true })).toBeVisible();
  });

  test('deleting a parent todo removes its subtasks', async ({ page }) => {
    const title = `Subtask cascade ${Date.now()}`;
    const subtaskTitle = `Child ${Date.now()}`;

    await loginAs(page, `subtask_cascade_${Date.now()}`);
    await createTodo(page, { title });

    const todoItem = getTodoItem(page, title);
    await openSubtasks(todoItem);
    await addSubtask(todoItem, subtaskTitle);
    await expect(todoItem.getByText(subtaskTitle, { exact: true })).toBeVisible();

    await todoItem.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
    await expect(page.getByText(subtaskTitle, { exact: true })).toHaveCount(0);
  });
});
