import path from 'node:path';
import Database from 'better-sqlite3';
import { shouldSendReminder, type ReminderMinutes } from '@/lib/reminders';
import { getSingaporeNow } from '@/lib/timezone';

export type Priority = 'high' | 'medium' | 'low';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

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
  recurrence_enabled: number;
  recurrence_pattern: RecurrencePattern | null;
  completed: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// In-memory storage for mock data when database is unavailable
const mockTodosStore: Map<number, Todo[]> = new Map();
let nextTodoId = 4;

// Initialize database with error handling
let db: Database.Database | null = null;
let dbError: Error | null = null;

try {
  const dbPath = path.join(process.cwd(), 'todos.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS todos (
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
      user_id INTEGER NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
      due_date TEXT,
    reminder_minutes INTEGER,
    last_notification_sent TEXT,
      recurrence_enabled INTEGER NOT NULL DEFAULT 0 CHECK (recurrence_enabled IN (0, 1)),
    recurrence_pattern TEXT CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly', 'yearly') OR recurrence_pattern IS NULL),
    completed INTEGER NOT NULL,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

  CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
  CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
`);

// Backfill recurrence columns for older databases created before recurrence support.
try {
  db.exec("ALTER TABLE todos ADD COLUMN recurrence_enabled INTEGER NOT NULL DEFAULT 0 CHECK (recurrence_enabled IN (0, 1))");
} catch {
  // Column already exists.
}

try {
  db.exec("ALTER TABLE todos ADD COLUMN recurrence_pattern TEXT CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly', 'yearly') OR recurrence_pattern IS NULL)");
} catch {
  // Column already exists.
}

const userSelectByUsername = db.prepare('SELECT id, username, created_at FROM users WHERE username = ?');
const userInsert = db.prepare('INSERT INTO users (username) VALUES (?)');
const userSelectById = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?');

const todoPriorityOrder = "CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END";

const todoSelectAllByUser = db.prepare(`
  SELECT id, user_id, title, priority, due_date, reminder_minutes, last_notification_sent, recurrence_enabled, recurrence_pattern, completed, completed_at, created_at, updated_at
  FROM todos
  WHERE user_id = ?
  ORDER BY completed ASC, ${todoPriorityOrder},
    CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
    due_date ASC,
    created_at DESC
`);

const todoSelectByIdAndUser = db.prepare(`
  SELECT id, user_id, title, priority, due_date, reminder_minutes, last_notification_sent, recurrence_enabled, recurrence_pattern, completed, completed_at, created_at, updated_at
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
  INSERT INTO todos (user_id, title, priority, due_date, reminder_minutes, last_notification_sent, recurrence_enabled, recurrence_pattern, completed, completed_at, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const todoUpdate = db?.prepare(`
  UPDATE todos
  SET title = ?, priority = ?, due_date = ?, reminder_minutes = ?, last_notification_sent = ?, recurrence_enabled = ?, recurrence_pattern = ?, completed = ?, completed_at = ?, updated_at = ?
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
    if (!db) {
      console.warn('[UserDB] Database unavailable, returning mock user for:', username);
      // Return a mock user for demo purposes
      return {
        id: 1,
        username,
        created_at: getSingaporeNow().toISOString(),
      };
    }
    const row = userSelectByUsername!.get(username) as User | undefined;
    return row ?? null;
  },

  findById(id: number): User | null {
    if (!db) {
      console.warn('[UserDB] Database unavailable, returning mock user for id:', id);
      return {
        id,
        username: 'demo_user',
        created_at: getSingaporeNow().toISOString(),
      };
    }
    const row = userSelectById!.get(id) as User | undefined;
    return row ?? null;
  },

  create(username: string): User {
    if (!db) {
      console.warn('[UserDB] Database unavailable, returning mock created user:', username);
      return {
        id: 1,
        username,
        created_at: getSingaporeNow().toISOString(),
      };
    }
    const createdAt = getSingaporeNow().toISOString();
    const info = userInsert!.run(username, createdAt);
    const created = this.findById(Number(info.lastInsertRowid));
    if (!created) {
      throw new Error('Failed to create user');
    }
    return created;
  },
};

export const todoDB = {
  listByUserId(userId: number): Todo[] {
    if (!db) {
      // Return persisted mock todos for this user
      if (!mockTodosStore.has(userId)) {
        mockTodosStore.set(userId, []);
      }
      console.warn('[TodoDB] Database unavailable, using mock storage for user:', userId);
      return mockTodosStore.get(userId) ?? [];
    }
    return todoSelectAllByUser!.all(userId) as Todo[];
  },

  findByIdForUser(id: number, userId: number): Todo | null {
    if (!db) {
      const todos = mockTodosStore.get(userId) ?? [];
      return todos.find((t) => t.id === id) ?? null;
    }
    const row = todoSelectByIdAndUser!.get(id, userId) as Todo | undefined;
    return row ?? null;
  },

  create(input: {
    userId: number;
    title: string;
    priority: Priority;
    dueDate: string | null;
    reminderMinutes: ReminderMinutes | null;
    recurrenceEnabled: boolean;
    recurrencePattern: RecurrencePattern | null;
  }): Todo {
    if (!db) {
      const nowIso = getSingaporeNow().toISOString();
      // Initialize store for user if needed
      if (!mockTodosStore.has(input.userId)) {
        mockTodosStore.set(input.userId, []);
      }
      const todo: Todo = {
        id: nextTodoId++,
        user_id: input.userId,
        title: input.title,
        priority: input.priority,
        due_date: input.dueDate,
        completed: 0,
        completed_at: null,
        created_at: nowIso,
        updated_at: nowIso,
      };
      const todos = mockTodosStore.get(input.userId)!;
      todos.push(todo);
      console.warn('[TodoDB] Database unavailable, created mock todo:', input.title);
      return todo;
    }
    const nowIso = getSingaporeNow().toISOString();
    const info = todoInsert!.run(
      input.userId,
      input.title,
      input.priority,
      input.dueDate,
      input.reminderMinutes,
      null,
      input.recurrenceEnabled ? 1 : 0,
      input.recurrenceEnabled ? input.recurrencePattern : null,
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
    recurrenceEnabled: boolean;
    recurrencePattern: RecurrencePattern | null;
    completed: boolean;
    completedAt: string | null;
  }): Todo | null {
    if (!db) {
      const todos = mockTodosStore.get(input.userId) ?? [];
      const todo = todos.find((t) => t.id === input.id);
      if (!todo) {
        return null;
      }
      todo.title = input.title;
      todo.priority = input.priority;
      todo.due_date = input.dueDate;
      todo.completed = input.completed ? 1 : 0;
      todo.completed_at = input.completedAt;
      todo.updated_at = getSingaporeNow().toISOString();
      console.warn('[TodoDB] Database unavailable, updated mock todo:', input.id);
      return todo;
    }
    const updatedAt = getSingaporeNow().toISOString();
    const result = todoUpdate!.run(
      input.title,
      input.priority,
      input.dueDate,
      input.reminderMinutes,
      input.lastNotificationSent,
      input.recurrenceEnabled ? 1 : 0,
      input.recurrenceEnabled ? input.recurrencePattern : null,
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
    if (!db) {
      const todos = mockTodosStore.get(userId) ?? [];
      const index = todos.findIndex((t) => t.id === id);
      if (index === -1) {
        return false;
      }
      todos.splice(index, 1);
      console.warn('[TodoDB] Database unavailable, deleted mock todo:', id);
      return true;
    }
    const result = todoDelete!.run(id, userId);
    return result.changes > 0;
  },
};