import path from 'node:path';
import Database from 'better-sqlite3';
import { shouldSendReminder, type ReminderMinutes } from '@/lib/reminders';
import { getSingaporeNow } from '@/lib/timezone';

export type Priority = 'high' | 'medium' | 'low';

export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface Todo {
  id: number;
  user_id: number;
  title: string;
  priority: Priority;
  due_date: string | null;
  reminder_minutes: number | null;
  last_notification_sent: string | null;
  completed: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

const dbPath = path.join(process.cwd(), 'todos.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    due_date TEXT,
    reminder_minutes INTEGER,
    last_notification_sent TEXT,
    completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
  CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
`);

try {
  db.exec('ALTER TABLE todos ADD COLUMN reminder_minutes INTEGER');
} catch {
  // Column already exists.
}

try {
  db.exec('ALTER TABLE todos ADD COLUMN last_notification_sent TEXT');
} catch {
  // Column already exists.
}

const userSelectByUsername = db.prepare('SELECT id, username, created_at FROM users WHERE username = ?');
const userInsert = db.prepare('INSERT INTO users (username) VALUES (?)');
const userSelectById = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?');

const todoPriorityOrder = "CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END";

const todoSelectAllByUser = db.prepare(`
  SELECT id, user_id, title, priority, due_date, reminder_minutes, last_notification_sent, completed, completed_at, created_at, updated_at
  FROM todos
  WHERE user_id = ?
  ORDER BY completed ASC, ${todoPriorityOrder},
    CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
    due_date ASC,
    created_at DESC
`);

const todoSelectByIdAndUser = db.prepare(`
  SELECT id, user_id, title, priority, due_date, reminder_minutes, last_notification_sent, completed, completed_at, created_at, updated_at
  FROM todos
  WHERE id = ? AND user_id = ?
`);

const todoSelectPendingRemindersByUser = db.prepare(`
  SELECT id, user_id, title, priority, due_date, reminder_minutes, last_notification_sent, completed, completed_at, created_at, updated_at
  FROM todos
  WHERE user_id = ?
    AND completed = 0
    AND due_date IS NOT NULL
    AND reminder_minutes IS NOT NULL
    AND last_notification_sent IS NULL
  ORDER BY due_date ASC
`);

const todoInsert = db.prepare(`
  INSERT INTO todos (user_id, title, priority, due_date, reminder_minutes, last_notification_sent, completed, completed_at, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const todoUpdate = db.prepare(`
  UPDATE todos
  SET title = ?, priority = ?, due_date = ?, reminder_minutes = ?, last_notification_sent = ?, completed = ?, completed_at = ?, updated_at = ?
  WHERE id = ? AND user_id = ?
`);

const todoMarkReminderSent = db.prepare(`
  UPDATE todos
  SET last_notification_sent = ?, updated_at = ?
  WHERE id = ? AND user_id = ? AND last_notification_sent IS NULL
`);

const todoClaimPendingRemindersByUser = db.transaction((input: {
  userId: number;
  now: Date;
  sentAt: string;
}) => {
  const candidates = todoSelectPendingRemindersByUser.all(input.userId) as Todo[];

  return candidates.flatMap((todo) => {
    if (
      !shouldSendReminder({
        dueDate: todo.due_date,
        reminderMinutes: todo.reminder_minutes ?? null,
        lastNotificationSent: todo.last_notification_sent ?? null,
        now: input.now,
      })
    ) {
      return [];
    }

    const result = todoMarkReminderSent.run(input.sentAt, input.sentAt, todo.id, input.userId);
    if (result.changes === 0) {
      return [];
    }

    return [
      {
        ...todo,
        reminder_minutes: todo.reminder_minutes ?? null,
        last_notification_sent: input.sentAt,
      },
    ];
  });
});

const todoDelete = db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?');

export const userDB = {
  findByUsername(username: string): User | null {
    const row = userSelectByUsername.get(username) as User | undefined;
    return row ?? null;
  },

  findById(id: number): User | null {
    const row = userSelectById.get(id) as User | undefined;
    return row ?? null;
  },

  create(username: string): User {
    const info = userInsert.run(username);
    const created = this.findById(Number(info.lastInsertRowid));
    if (!created) {
      throw new Error('Failed to create user');
    }
    return created;
  },
};

export const todoDB = {
  listByUserId(userId: number): Todo[] {
    return todoSelectAllByUser.all(userId) as Todo[];
  },

  findByIdForUser(id: number, userId: number): Todo | null {
    const row = todoSelectByIdAndUser.get(id, userId) as Todo | undefined;
    return row ?? null;
  },

  create(input: {
    userId: number;
    title: string;
    priority: Priority;
    dueDate: string | null;
    reminderMinutes: ReminderMinutes | null;
  }): Todo {
    const nowIso = getSingaporeNow().toISOString();
    const info = todoInsert.run(
      input.userId,
      input.title,
      input.priority,
      input.dueDate,
      input.reminderMinutes,
      null,
      0,
      null,
      nowIso,
      nowIso,
    );
    const created = this.findByIdForUser(Number(info.lastInsertRowid), input.userId);
    if (!created) {
      throw new Error('Failed to create todo');
    }
    return created;
  },

  update(input: {
    id: number;
    userId: number;
    title: string;
    priority: Priority;
    dueDate: string | null;
    reminderMinutes: ReminderMinutes | null;
    lastNotificationSent: string | null;
    completed: boolean;
    completedAt: string | null;
  }): Todo | null {
    const updatedAt = getSingaporeNow().toISOString();
    const result = todoUpdate.run(
      input.title,
      input.priority,
      input.dueDate,
      input.reminderMinutes,
      input.lastNotificationSent,
      input.completed ? 1 : 0,
      input.completedAt,
      updatedAt,
      input.id,
      input.userId,
    );

    if (result.changes === 0) {
      return null;
    }

    return this.findByIdForUser(input.id, input.userId);
  },

  listPendingRemindersByUser(userId: number): Todo[] {
    return todoSelectPendingRemindersByUser.all(userId) as Todo[];
  },

  claimPendingRemindersByUser(input: { userId: number; now: Date; sentAt: string }): Todo[] {
    return todoClaimPendingRemindersByUser(input);
  },

  markReminderSent(id: number, userId: number, sentAt: string): boolean {
    const result = todoMarkReminderSent.run(sentAt, sentAt, id, userId);
    return result.changes > 0;
  },

  delete(id: number, userId: number): boolean {
    const result = todoDelete.run(id, userId);
    return result.changes > 0;
  },
};