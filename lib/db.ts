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

export interface Authenticator {
  id: number;
  user_id: number;
  credential_id: string; // Base64url-encoded
  public_key: Buffer; // CBOR-encoded
  counter: number;
  transports: string[] | null; // Parsed from JSON
  aaguid: string | null;
  backed_up: number; // 0 or 1
  backup_eligible: number; // 0 or 1
  device_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebAuthnChallenge {
  id: number;
  challenge: string; // Base64url-encoded
  user_id: number | null;
  operation: 'registration' | 'login';
  created_at: string;
  expires_at: string;
}

export interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed: number;
  position: number;
  created_at: string;
}

export interface Template {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  category: string | null;
  title_template: string;
  priority: Priority;
  recurrence_enabled: number;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  created_at: string;
}

export interface Holiday {
  id: number;
  date: string;
  name: string;
  year: number;
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

export interface TodoWithDetails extends Todo {
  tags: Tag[];
  subtasks: Subtask[];
}

type ClaimPendingRemindersInput = {
  userId: number;
  now: Date;
  sentAt: string;
};

const dbPath = path.join(process.cwd(), 'todos.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS authenticators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    credential_id TEXT NOT NULL UNIQUE,
    public_key BLOB NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    transports TEXT,
    aaguid TEXT,
    backed_up INTEGER NOT NULL DEFAULT 0,
    backup_eligible INTEGER NOT NULL DEFAULT 0,
    device_name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS webauthn_challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenge TEXT NOT NULL UNIQUE,
    user_id INTEGER,
    operation TEXT NOT NULL CHECK (operation IN ('registration', 'login')),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    due_date TEXT,
    reminder_minutes INTEGER,
    last_notification_sent TEXT,
    recurrence_enabled INTEGER NOT NULL DEFAULT 0 CHECK (recurrence_enabled IN (0, 1)),
    recurrence_pattern TEXT CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly', 'yearly') OR recurrence_pattern IS NULL),
    completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (user_id, name)
  );

  CREATE TABLE IF NOT EXISTS todo_tags (
    todo_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (todo_id, tag_id),
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    title_template TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    recurrence_enabled INTEGER NOT NULL DEFAULT 0 CHECK (recurrence_enabled IN (0, 1)),
    recurrence_pattern TEXT CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly', 'yearly') OR recurrence_pattern IS NULL),
    reminder_minutes INTEGER,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    year INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
  CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
  CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
  CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
  CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id ON subtasks(todo_id);
  CREATE INDEX IF NOT EXISTS idx_holidays_year ON holidays(year);
  CREATE INDEX IF NOT EXISTS idx_authenticators_user_id ON authenticators(user_id);
  CREATE INDEX IF NOT EXISTS idx_authenticators_credential_id ON authenticators(credential_id);
  CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_challenge ON webauthn_challenges(challenge);
  CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_user_id_operation ON webauthn_challenges(user_id, operation);
  CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires_at ON webauthn_challenges(expires_at);
`);

try {
  db.exec("ALTER TABLE todos ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low'))");
} catch {
  // Column already exists.
}
try {
  db.exec('ALTER TABLE todos ADD COLUMN due_date TEXT');
} catch {
  // Column already exists.
}
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
try {
  db.exec('ALTER TABLE todos ADD COLUMN completed INTEGER NOT NULL DEFAULT 0');
} catch {
  // Column already exists.
}
try {
  db.exec('ALTER TABLE todos ADD COLUMN completed_at TEXT');
} catch {
  // Column already exists.
}
try {
  db.exec('ALTER TABLE todos ADD COLUMN created_at TEXT');
} catch {
  // Column already exists.
}
try {
  db.exec('ALTER TABLE todos ADD COLUMN updated_at TEXT');
} catch {
  // Column already exists.
}
try {
  db.exec("ALTER TABLE subtasks ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
} catch {
  // Column already exists.
}

const migrationTimestamp = getSingaporeNow().toISOString();
db.prepare(`
  UPDATE todos
  SET created_at = COALESCE(created_at, ?),
      updated_at = COALESCE(updated_at, created_at, ?),
      completed = COALESCE(completed, 0),
      recurrence_enabled = COALESCE(recurrence_enabled, 0)
`).run(migrationTimestamp, migrationTimestamp);

db.prepare(`
  UPDATE subtasks
  SET updated_at = COALESCE(updated_at, created_at, ?)
`).run(migrationTimestamp);

const userSelectByUsername = db.prepare(
  'SELECT id, username, created_at FROM users WHERE username = ?'
);
const userSelectById = db.prepare(
  'SELECT id, username, created_at FROM users WHERE id = ?'
);
const userInsert = db.prepare(
  'INSERT INTO users (username, created_at) VALUES (?, ?)'
);

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
const todoInsert = db.prepare(`
  INSERT INTO todos (
    user_id,
    title,
    priority,
    due_date,
    reminder_minutes,
    last_notification_sent,
    recurrence_enabled,
    recurrence_pattern,
    completed,
    completed_at,
    created_at,
    updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const todoUpdate = db.prepare(`
  UPDATE todos
  SET title = ?, priority = ?, due_date = ?, reminder_minutes = ?, last_notification_sent = ?, recurrence_enabled = ?, recurrence_pattern = ?, completed = ?, completed_at = ?, updated_at = ?
  WHERE id = ? AND user_id = ?
`);
const todoDelete = db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?');
const todoSelectPendingRemindersByUser = db.prepare(`
  SELECT id, user_id, title, priority, due_date, reminder_minutes, last_notification_sent, recurrence_enabled, recurrence_pattern, completed, completed_at, created_at, updated_at
  FROM todos
  WHERE user_id = ?
    AND completed = 0
    AND due_date IS NOT NULL
    AND reminder_minutes IS NOT NULL
    AND last_notification_sent IS NULL
  ORDER BY due_date ASC
`);
const todoMarkReminderSent = db.prepare(`
  UPDATE todos
  SET last_notification_sent = ?, updated_at = ?
  WHERE id = ? AND user_id = ? AND last_notification_sent IS NULL
`);

function mapTodoRelations(userId: number, todos: Todo[]): TodoWithDetails[] {
  if (todos.length === 0) {
    return [];
  }

  const placeholders = todos.map(() => '?').join(', ');
  const ids = todos.map((todo) => todo.id);

  const tagRows = db.prepare(`
    SELECT tt.todo_id, t.id, t.user_id, t.name, t.color, t.created_at
    FROM todo_tags tt
    INNER JOIN tags t ON t.id = tt.tag_id
    WHERE t.user_id = ? AND tt.todo_id IN (${placeholders})
    ORDER BY t.name ASC
  `).all(userId, ...ids) as Array<Tag & { todo_id: number }>;

  const subtaskRows = db.prepare(`
    SELECT s.id, s.todo_id, s.title, s.completed, s.position, s.created_at
    FROM subtasks s
    INNER JOIN todos td ON td.id = s.todo_id
    WHERE td.user_id = ? AND s.todo_id IN (${placeholders})
    ORDER BY s.position ASC, s.created_at ASC
  `).all(userId, ...ids) as Subtask[];

  const tagsByTodo = new Map<number, Tag[]>();
  for (const row of tagRows) {
    const current = tagsByTodo.get(row.todo_id) ?? [];
    tagsByTodo.set(row.todo_id, [
      ...current,
      {
        id: row.id,
        user_id: row.user_id,
        name: row.name,
        color: row.color,
        created_at: row.created_at,
      },
    ]);
  }

  const subtasksByTodo = new Map<number, Subtask[]>();
  for (const row of subtaskRows) {
    const current = subtasksByTodo.get(row.todo_id) ?? [];
    subtasksByTodo.set(row.todo_id, [...current, row]);
  }

  return todos.map((todo) => ({
    ...todo,
    tags: tagsByTodo.get(todo.id) ?? [],
    subtasks: subtasksByTodo.get(todo.id) ?? [],
  }));
}

const todoClaimPendingRemindersByUser = db.transaction((input: ClaimPendingRemindersInput): Todo[] => {
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

    return [{
      ...todo,
      last_notification_sent: input.sentAt,
      updated_at: input.sentAt,
    }];
  });
});

function sanitizeTagColor(color: string): string {
  const normalized = color.trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(normalized)) {
    throw new Error('Tag color must be a valid hex value like #0ea5e9');
  }
  return normalized;
}

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
    const createdAt = getSingaporeNow().toISOString();
    const info = userInsert.run(username, createdAt);
    const created = this.findById(Number(info.lastInsertRowid));
    if (!created) {
      throw new Error('Failed to create user');
    }
    return created;
  },
};

export const tagDB = {
  listByUserId(userId: number): Tag[] {
    return db.prepare(
      'SELECT id, user_id, name, color, created_at FROM tags WHERE user_id = ? ORDER BY name ASC'
    ).all(userId) as Tag[];
  },

  findByIdForUser(id: number, userId: number): Tag | null {
    const row = db.prepare(
      'SELECT id, user_id, name, color, created_at FROM tags WHERE id = ? AND user_id = ?'
    ).get(id, userId) as Tag | undefined;
    return row ?? null;
  },

  create(input: { userId: number; name: string; color: string }): Tag {
    const createdAt = getSingaporeNow().toISOString();
    const info = db.prepare(
      'INSERT INTO tags (user_id, name, color, created_at) VALUES (?, ?, ?, ?)'
    ).run(input.userId, input.name.trim(), sanitizeTagColor(input.color), createdAt);
    const created = this.findByIdForUser(Number(info.lastInsertRowid), input.userId);
    if (!created) {
      throw new Error('Failed to create tag');
    }
    return created;
  },

  update(input: { id: number; userId: number; name: string; color: string }): Tag | null {
    const result = db.prepare(
      'UPDATE tags SET name = ?, color = ? WHERE id = ? AND user_id = ?'
    ).run(input.name.trim(), sanitizeTagColor(input.color), input.id, input.userId);
    if (result.changes === 0) {
      return null;
    }
    return this.findByIdForUser(input.id, input.userId);
  },

  delete(id: number, userId: number): boolean {
    const result = db.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').run(id, userId);
    return result.changes > 0;
  },

  setTagsForTodo(input: { todoId: number; userId: number; tagIds: number[] }): void {
    const tx = db.transaction((payload: { todoId: number; userId: number; tagIds: number[] }) => {
      const todoRow = db.prepare('SELECT id FROM todos WHERE id = ? AND user_id = ?').get(payload.todoId, payload.userId) as { id: number } | undefined;
      if (!todoRow) {
        return;
      }

      db.prepare(`
        DELETE FROM todo_tags
        WHERE todo_id = ?
      `).run(payload.todoId);

      if (payload.tagIds.length === 0) {
        return;
      }

      const validTagRows = db.prepare(`
        SELECT id FROM tags
        WHERE user_id = ? AND id IN (${payload.tagIds.map(() => '?').join(', ')})
      `).all(payload.userId, ...payload.tagIds) as Array<{ id: number }>;

      const validIds = new Set(validTagRows.map((row) => row.id));
      const insert = db.prepare('INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)');
      for (const tagId of payload.tagIds) {
        if (validIds.has(tagId)) {
          insert.run(payload.todoId, tagId);
        }
      }
    });

    tx(input);
  },
};

export const subtaskDB = {
  listByTodoId(todoId: number, userId: number): Subtask[] {
    return db.prepare(`
      SELECT s.id, s.todo_id, s.title, s.completed, s.position, s.created_at
      FROM subtasks s
      INNER JOIN todos t ON t.id = s.todo_id
      WHERE s.todo_id = ? AND t.user_id = ?
      ORDER BY s.position ASC, s.created_at ASC
    `).all(todoId, userId) as Subtask[];
  },

  create(input: { todoId: number; userId: number; title: string; position: number }): Subtask {
    const todo = db.prepare('SELECT id FROM todos WHERE id = ? AND user_id = ?').get(input.todoId, input.userId);
    if (!todo) {
      throw new Error('Todo not found');
    }

    const createdAt = getSingaporeNow().toISOString();
    const info = db.prepare(
      'INSERT INTO subtasks (todo_id, title, completed, position, created_at, updated_at) VALUES (?, ?, 0, ?, ?, ?)'
    ).run(input.todoId, input.title.trim(), input.position, createdAt, createdAt);

    const created = db.prepare(
      'SELECT id, todo_id, title, completed, position, created_at FROM subtasks WHERE id = ?'
    ).get(Number(info.lastInsertRowid)) as Subtask | undefined;

    if (!created) {
      throw new Error('Failed to create subtask');
    }

    return created;
  },

  setCompleted(input: {
    subtaskId: number;
    todoId: number;
    userId: number;
    completed: boolean;
  }): Subtask | null {
    const todo = db.prepare('SELECT id FROM todos WHERE id = ? AND user_id = ?').get(input.todoId, input.userId);
    if (!todo) {
      return null;
    }

    const result = db.prepare(
      'UPDATE subtasks SET completed = ? WHERE id = ? AND todo_id = ?'
    ).run(input.completed ? 1 : 0, input.subtaskId, input.todoId);

    if (result.changes === 0) {
      return null;
    }

    const updated = db.prepare(
      'SELECT id, todo_id, title, completed, position, created_at FROM subtasks WHERE id = ?'
    ).get(input.subtaskId) as Subtask | undefined;

    return updated ?? null;
  },

  delete(input: {
    subtaskId: number;
    todoId: number;
    userId: number;
  }): boolean {
    const todo = db.prepare('SELECT id FROM todos WHERE id = ? AND user_id = ?').get(input.todoId, input.userId);
    if (!todo) {
      return false;
    }

    const result = db.prepare('DELETE FROM subtasks WHERE id = ? AND todo_id = ?').run(input.subtaskId, input.todoId);
    return result.changes > 0;
  },
};

export const templateDB = {
  listByUserId(userId: number): Template[] {
    return db.prepare(`
      SELECT id, user_id, name, description, category, title_template, priority, recurrence_enabled, recurrence_pattern, reminder_minutes, created_at
      FROM templates
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId) as Template[];
  },

  findByIdForUser(id: number, userId: number): Template | null {
    const row = db.prepare(`
      SELECT id, user_id, name, description, category, title_template, priority, recurrence_enabled, recurrence_pattern, reminder_minutes, created_at
      FROM templates
      WHERE id = ? AND user_id = ?
    `).get(id, userId) as Template | undefined;
    return row ?? null;
  },

  create(input: {
    userId: number;
    name: string;
    description: string | null;
    category: string | null;
    titleTemplate: string;
    priority: Priority;
    recurrenceEnabled: boolean;
    recurrencePattern: RecurrencePattern | null;
    reminderMinutes: ReminderMinutes | null;
  }): Template {
    const createdAt = getSingaporeNow().toISOString();
    const info = db.prepare(`
      INSERT INTO templates (
        user_id,
        name,
        description,
        category,
        title_template,
        priority,
        recurrence_enabled,
        recurrence_pattern,
        reminder_minutes,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.userId,
      input.name.trim(),
      input.description,
      input.category,
      input.titleTemplate,
      input.priority,
      input.recurrenceEnabled ? 1 : 0,
      input.recurrenceEnabled ? input.recurrencePattern : null,
      input.reminderMinutes,
      createdAt,
    );

    const created = this.findByIdForUser(Number(info.lastInsertRowid), input.userId);
    if (!created) {
      throw new Error('Failed to create template');
    }
    return created;
  },

  delete(id: number, userId: number): boolean {
    const result = db.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?').run(id, userId);
    return result.changes > 0;
  },
};

export const holidayDB = {
  upsertMany(holidays: Array<{ date: string; name: string; year: number }>): void {
    const tx = db.transaction((records: Array<{ date: string; name: string; year: number }>) => {
      const stmt = db.prepare('INSERT OR REPLACE INTO holidays (date, name, year) VALUES (?, ?, ?)');
      for (const holiday of records) {
        stmt.run(holiday.date, holiday.name, holiday.year);
      }
    });
    tx(holidays);
  },

  listByMonth(year: number, month: number): Holiday[] {
    const monthStr = String(month).padStart(2, '0');
    return db.prepare(`
      SELECT id, date, name, year
      FROM holidays
      WHERE year = ? AND strftime('%m', date) = ?
      ORDER BY date ASC
    `).all(year, monthStr) as Holiday[];
  },
};

export const todoDB = {
  listByUserId(userId: number): TodoWithDetails[] {
    const rows = todoSelectAllByUser.all(userId) as Todo[];
    return mapTodoRelations(userId, rows);
  },

  findByIdForUser(id: number, userId: number): TodoWithDetails | null {
    const row = todoSelectByIdAndUser.get(id, userId) as Todo | undefined;
    if (!row) {
      return null;
    }
    return mapTodoRelations(userId, [row])[0] ?? null;
  },

  create(input: {
    userId: number;
    title: string;
    priority: Priority;
    dueDate: string | null;
    reminderMinutes: ReminderMinutes | null;
    recurrenceEnabled: boolean;
    recurrencePattern: RecurrencePattern | null;
    tagIds?: number[];
    completed?: boolean;
    completedAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
    lastNotificationSent?: string | null;
  }): TodoWithDetails {
    const nowIso = getSingaporeNow().toISOString();
    const createdAt = input.createdAt ?? nowIso;
    const updatedAt = input.updatedAt ?? createdAt;
    const completed = input.completed ?? false;
    const info = todoInsert.run(
      input.userId,
      input.title,
      input.priority,
      input.dueDate,
      input.reminderMinutes,
      input.lastNotificationSent ?? null,
      input.recurrenceEnabled ? 1 : 0,
      input.recurrenceEnabled ? input.recurrencePattern : null,
      completed ? 1 : 0,
      completed ? input.completedAt ?? null : null,
      createdAt,
      updatedAt,
    );

    const todoId = Number(info.lastInsertRowid);
    if (input.tagIds) {
      tagDB.setTagsForTodo({
        todoId,
        userId: input.userId,
        tagIds: input.tagIds,
      });
    }

    const created = this.findByIdForUser(todoId, input.userId);
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
    tagIds?: number[];
  }): TodoWithDetails | null {
    const updatedAt = getSingaporeNow().toISOString();
    const result = todoUpdate.run(
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

    if (input.tagIds) {
      tagDB.setTagsForTodo({
        todoId: input.id,
        userId: input.userId,
        tagIds: input.tagIds,
      });
    }

    return this.findByIdForUser(input.id, input.userId);
  },

  listPendingRemindersByUser(userId: number): Todo[] {
    return todoSelectPendingRemindersByUser.all(userId) as Todo[];
  },

  claimPendingRemindersByUser(input: ClaimPendingRemindersInput): Todo[] {
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

export const authenticatorDB = {
  findByCredentialId(credentialId: string): Authenticator | null {
    const row = db.prepare(`
      SELECT id, user_id, credential_id, public_key, counter, transports, aaguid, 
             backed_up, backup_eligible, device_name, created_at, updated_at
      FROM authenticators
      WHERE credential_id = ?
    `).get(credentialId) as Record<string, unknown> | undefined;
    
    if (!row) return null;
    
    return {
      id: row.id as number,
      user_id: row.user_id as number,
      credential_id: row.credential_id as string,
      public_key: Buffer.from(row.public_key as Buffer | Uint8Array),
      counter: (row.counter as number | null) ?? 0,
      transports: row.transports ? JSON.parse(row.transports as string) : null,
      aaguid: row.aaguid as string | null,
      backed_up: row.backed_up as number,
      backup_eligible: row.backup_eligible as number,
      device_name: row.device_name as string | null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  },

  listByUserId(userId: number): Authenticator[] {
    const rows = db.prepare(`
      SELECT id, user_id, credential_id, public_key, counter, transports, aaguid,
             backed_up, backup_eligible, device_name, created_at, updated_at
      FROM authenticators
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId) as Array<Record<string, unknown>>;
    
    return rows.map(row => ({
      id: row.id as number,
      user_id: row.user_id as number,
      credential_id: row.credential_id as string,
      public_key: Buffer.from(row.public_key as Buffer | Uint8Array),
      counter: (row.counter as number | null) ?? 0,
      transports: row.transports ? JSON.parse(row.transports as string) : null,
      aaguid: row.aaguid as string | null,
      backed_up: row.backed_up as number,
      backup_eligible: row.backup_eligible as number,
      device_name: row.device_name as string | null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    }));
  },

  create(input: {
    userId: number;
    credentialId: string;
    publicKey: Buffer;
    counter: number;
    transports?: string[];
    aaguid?: string;
    backedUp: boolean;
    backupEligible: boolean;
    deviceName?: string;
  }): Authenticator {
    const now = getSingaporeNow().toISOString();
    const info = db.prepare(`
      INSERT INTO authenticators (
        user_id, credential_id, public_key, counter, transports, aaguid,
        backed_up, backup_eligible, device_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.userId,
      input.credentialId,
      input.publicKey,
      input.counter ?? 0,
      input.transports ? JSON.stringify(input.transports) : null,
      input.aaguid ?? null,
      input.backedUp ? 1 : 0,
      input.backupEligible ? 1 : 0,
      input.deviceName ?? null,
      now,
      now
    );

    const created = this.findByCredentialId(input.credentialId);
    if (!created) {
      throw new Error('Failed to create authenticator');
    }
    return created;
  },

  updateCounter(credentialId: string, newCounter: number): Authenticator | null {
    const now = getSingaporeNow().toISOString();
    const result = db.prepare(`
      UPDATE authenticators
      SET counter = ?, updated_at = ?
      WHERE credential_id = ?
    `).run(newCounter, now, credentialId);

    if (result.changes === 0) return null;
    return this.findByCredentialId(credentialId);
  },

  delete(id: number, userId: number): boolean {
    const result = db.prepare(`
      DELETE FROM authenticators WHERE id = ? AND user_id = ?
    `).run(id, userId);
    return result.changes > 0;
  },
};

export const challengeDB = {
  findByChallenge(challenge: string): WebAuthnChallenge | null {
    const row = db.prepare(`
      SELECT id, challenge, user_id, operation, created_at, expires_at
      FROM webauthn_challenges
      WHERE challenge = ?
    `).get(challenge) as Record<string, unknown> | undefined;
    
    if (!row) return null;
    
    return {
      id: row.id as number,
      challenge: row.challenge as string,
      user_id: row.user_id as number | null,
      operation: row.operation as 'registration' | 'login',
      created_at: row.created_at as string,
      expires_at: row.expires_at as string,
    };
  },

  create(input: {
    challenge: string;
    userId?: number;
    operation: 'registration' | 'login';
    expiresIn: number; // Minutes
  }): WebAuthnChallenge {
    const now = getSingaporeNow();
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + input.expiresIn * 60 * 1000).toISOString();
    
    const info = db.prepare(`
      INSERT INTO webauthn_challenges (challenge, user_id, operation, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      input.challenge,
      input.userId ?? null,
      input.operation,
      createdAt,
      expiresAt
    );

    const created = this.findByChallenge(input.challenge);
    if (!created) {
      throw new Error('Failed to create challenge');
    }
    return created;
  },

  consume(challenge: string): WebAuthnChallenge | null {
    const found = this.findByChallenge(challenge);
    if (!found) return null;
    
    if (new Date(found.expires_at) < getSingaporeNow()) {
      // Challenge expired, delete it
      db.prepare('DELETE FROM webauthn_challenges WHERE id = ?').run(found.id);
      return null;
    }

    // Delete the challenge after consuming it
    db.prepare('DELETE FROM webauthn_challenges WHERE id = ?').run(found.id);
    return found;
  },

  cleanupExpired(): number {
    const now = getSingaporeNow().toISOString();
    const result = db.prepare(`
      DELETE FROM webauthn_challenges
      WHERE expires_at < ?
    `).run(now);
    return result.changes;
  },
};