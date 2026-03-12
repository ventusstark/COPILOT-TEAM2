import { describe, expect, test } from 'vitest';
import { getSingaporeNow } from '@/lib/timezone';
import { holidayDB, subtaskDB, tagDB, templateDB, todoDB, userDB } from '@/lib/db';

describe('database integration', () => {
  test('user, tag, todo, subtask and template lifecycle works', () => {
    const stamp = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const username = `it_user_${stamp}`;

    const user = userDB.create(username);
    expect(user.username).toBe(username);
    expect(userDB.findByUsername(username)?.id).toBe(user.id);

    const tag = tagDB.create({ userId: user.id, name: `tag_${stamp}`, color: '#0ea5e9' });
    expect(tag.name).toBe(`tag_${stamp}`);

    const dueDate = new Date(getSingaporeNow().getTime() + 60 * 60 * 1000).toISOString();
    const todo = todoDB.create({
      userId: user.id,
      title: `todo_${stamp}`,
      priority: 'high',
      dueDate,
      reminderMinutes: 60,
      recurrenceEnabled: true,
      recurrencePattern: 'daily',
      tagIds: [tag.id],
    });

    expect(todo.title).toBe(`todo_${stamp}`);
    expect(todo.tags.some((t) => t.id === tag.id)).toBe(true);

    const subtask = subtaskDB.create({
      todoId: todo.id,
      userId: user.id,
      title: `subtask_${stamp}`,
      position: 1,
    });
    expect(subtask.title).toBe(`subtask_${stamp}`);

    const subtasks = subtaskDB.listByTodoId(todo.id, user.id);
    expect(subtasks.length).toBeGreaterThan(0);

    const updated = todoDB.update({
      id: todo.id,
      userId: user.id,
      title: `todo_updated_${stamp}`,
      priority: 'low',
      dueDate,
      reminderMinutes: 30,
      lastNotificationSent: null,
      recurrenceEnabled: false,
      recurrencePattern: null,
      completed: true,
      completedAt: new Date().toISOString(),
      tagIds: [tag.id],
    });

    expect(updated?.title).toBe(`todo_updated_${stamp}`);
    expect(updated?.completed).toBe(1);

    const template = templateDB.create({
      userId: user.id,
      name: `tpl_${stamp}`,
      description: 'template',
      category: 'work',
      titleTemplate: 'Template Title',
      priority: 'medium',
      recurrenceEnabled: false,
      recurrencePattern: null,
      reminderMinutes: 60,
    });
    expect(template.name).toBe(`tpl_${stamp}`);

    const templates = templateDB.listByUserId(user.id);
    expect(templates.some((t) => t.id === template.id)).toBe(true);

    holidayDB.upsertMany([
      { date: '2026-01-01', name: 'New Year', year: 2026 },
      { date: '2026-02-01', name: 'Sample Holiday', year: 2026 },
    ]);
    const januaryHolidays = holidayDB.listByMonth(2026, 1);
    expect(januaryHolidays.some((h) => h.date === '2026-01-01')).toBe(true);

    expect(templateDB.delete(template.id, user.id)).toBe(true);
    expect(todoDB.delete(todo.id, user.id)).toBe(true);
    expect(tagDB.delete(tag.id, user.id)).toBe(true);
  });

  test('claimPendingRemindersByUser marks reminder as sent once', () => {
    const stamp = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const user = userDB.create(`it_user_reminder_${stamp}`);

    const dueDate = '2026-03-15T10:00:00+08:00';
    const todo = todoDB.create({
      userId: user.id,
      title: `reminder_${stamp}`,
      priority: 'medium',
      dueDate,
      reminderMinutes: 60,
      recurrenceEnabled: false,
      recurrencePattern: null,
    });

    const claimedFirst = todoDB.claimPendingRemindersByUser({
      userId: user.id,
      now: new Date('2026-03-15T01:05:00.000Z'),
      sentAt: '2026-03-15T01:05:00.000Z',
    });
    expect(claimedFirst.some((item) => item.id === todo.id)).toBe(true);

    const claimedSecond = todoDB.claimPendingRemindersByUser({
      userId: user.id,
      now: new Date('2026-03-15T01:06:00.000Z'),
      sentAt: '2026-03-15T01:06:00.000Z',
    });
    expect(claimedSecond.some((item) => item.id === todo.id)).toBe(false);

    expect(todoDB.delete(todo.id, user.id)).toBe(true);
  });
});
