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
  subtasks?: Subtask[];
  subtask_count_total?: number;
  subtask_count_completed?: number;
  subtask_progress_percent?: number;
}

export interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed: number;
  position: number;
  created_at: string;
  updated_at: string;
}

type PreparedStatement = Database.Statement<any[]>;
type ClaimPendingRemindersInput = {
  userId: number;
  now: Date;
  sentAt: string;
};

// In-memory storage for mock data when database is unavailable
const mockTodosStore: Map<number, Todo[]> = new Map();
const mockSubtasksStore: Map<number, Subtask[]> = new Map();
let nextTodoId = 4;
let nextSubtaskId = 1;

// Initialize database with error handling
let db: Database.Database | null = null;
let dbError: Error | null = null;
let userSelectByUsername: PreparedStatement | null = null;
let userInsert: PreparedStatement | null = null;
let userSelectById: PreparedStatement | null = null;
let todoSelectAllByUser: PreparedStatement | null = null;
let todoSelectByIdAndUser: PreparedStatement | null = null;
let todoInsert: PreparedStatement | null = null;
let todoSelectPendingRemindersByUser: PreparedStatement | null = null;
let todoUpdate: PreparedStatement | null = null;
let todoMarkReminderSent: PreparedStatement | null = null;
let todoDelete: PreparedStatement | null = null;
let todoClaimPendingRemindersByUser:
  | ((input: ClaimPendingRemindersInput) => Todo[])
  | null = null;
let subtaskSelectByTodoAndUser: PreparedStatement | null = null;
let subtaskSelectByIdForTodoAndUser: PreparedStatement | null = null;
let subtaskSelectNextPositionByTodo: PreparedStatement | null = null;
let subtaskInsert: PreparedStatement | null = null;
let subtaskUpdateCompleted: PreparedStatement | null = null;
let subtaskDelete: PreparedStatement | null = null;
let subtaskCreateTransactional:
  | ((input: {
      todoId: number;
      userId: number;
      title: string;
      nowIso: string;
    }) => Subtask | null)
  | null = null;

function calculateSubtaskProgress(subtasks: Subtask[]): {
  total: number;
  completed: number;
  percentage: number;
} {
  const total = subtasks.length;
  const completed = subtasks.filter((subtask) => subtask.completed === 1).length;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  return {
    total,
    completed,
    percentage,
  };
}

function enrichTodoWithSubtasks(todo: Todo, subtasks: Subtask[]): Todo {
  const progress = calculateSubtaskProgress(subtasks);

  return {
    ...todo,
    subtasks,
    subtask_count_total: progress.total,
    subtask_count_completed: progress.completed,
    subtask_progress_percent: progress.percentage,
  };
}

try {
  const dbPath = path.join(process.cwd(), 'todos.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
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

    CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
    CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);

    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      todo_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
      position INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id ON subtasks(todo_id);
    CREATE INDEX IF NOT EXISTS idx_subtasks_todo_position ON subtasks(todo_id, position);
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

  userSelectByUsername = db.prepare('SELECT id, username, created_at FROM users WHERE username = ?');
  userInsert = db.prepare('INSERT INTO users (username, created_at) VALUES (?, ?)');
  userSelectById = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?');

  const todoPriorityOrder = "CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END";

  todoSelectAllByUser = db.prepare(`
    SELECT id, user_id, title, priority, due_date, reminder_minutes, last_notification_sent, recurrence_enabled, recurrence_pattern, completed, completed_at, created_at, updated_at
    FROM todos
    WHERE user_id = ?
    ORDER BY completed ASC, ${todoPriorityOrder},
      CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
      due_date ASC,
      created_at DESC
  `);

  todoSelectByIdAndUser = db.prepare(`
    SELECT id, user_id, title, priority, due_date, reminder_minutes, last_notification_sent, recurrence_enabled, recurrence_pattern, completed, completed_at, created_at, updated_at
    FROM todos
    WHERE id = ? AND user_id = ?
  `);

  todoInsert = db.prepare(`
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

  todoSelectPendingRemindersByUser = db.prepare(`
    SELECT id, user_id, title, priority, due_date, reminder_minutes, last_notification_sent, recurrence_enabled, recurrence_pattern, completed, completed_at, created_at, updated_at
    FROM todos
    WHERE user_id = ?
      AND completed = 0
      AND due_date IS NOT NULL
      AND reminder_minutes IS NOT NULL
      AND last_notification_sent IS NULL
    ORDER BY due_date ASC
  `);

  todoUpdate = db.prepare(`
    UPDATE todos
    SET title = ?, priority = ?, due_date = ?, reminder_minutes = ?, last_notification_sent = ?, recurrence_enabled = ?, recurrence_pattern = ?, completed = ?, completed_at = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `);

  todoMarkReminderSent = db.prepare(`
    UPDATE todos
    SET last_notification_sent = ?, updated_at = ?
    WHERE id = ? AND user_id = ? AND last_notification_sent IS NULL
  `);

  todoClaimPendingRemindersByUser = db.transaction((input: ClaimPendingRemindersInput) => {
    const candidates = todoSelectPendingRemindersByUser!.all(input.userId) as Todo[];

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

      const result = todoMarkReminderSent!.run(input.sentAt, input.sentAt, todo.id, input.userId);
      if (result.changes === 0) {
        return [];
      }

      return [
        {
          ...todo,
          reminder_minutes: todo.reminder_minutes ?? null,
          last_notification_sent: input.sentAt,
          updated_at: input.sentAt,
        },
      ];
    });
  });

  todoDelete = db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?');

  subtaskSelectByTodoAndUser = db.prepare(`
    SELECT s.id, s.todo_id, s.title, s.completed, s.position, s.created_at, s.updated_at
    FROM subtasks s
    INNER JOIN todos t ON t.id = s.todo_id
    WHERE s.todo_id = ? AND t.user_id = ?
    ORDER BY s.position ASC, s.id ASC
  `);

  subtaskSelectByIdForTodoAndUser = db.prepare(`
    SELECT s.id, s.todo_id, s.title, s.completed, s.position, s.created_at, s.updated_at
    FROM subtasks s
    INNER JOIN todos t ON t.id = s.todo_id
    WHERE s.id = ? AND s.todo_id = ? AND t.user_id = ?
  `);

  subtaskSelectNextPositionByTodo = db.prepare(`
    SELECT COALESCE(MAX(position), 0) + 1 AS next_position
    FROM subtasks
    WHERE todo_id = ?
  `);

  subtaskInsert = db.prepare(`
    INSERT INTO subtasks (
      todo_id,
      title,
      completed,
      position,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  subtaskUpdateCompleted = db.prepare(`
    UPDATE subtasks
    SET completed = ?, updated_at = ?
    WHERE id = ? AND todo_id = ? AND todo_id IN (
      SELECT id
      FROM todos
      WHERE id = ? AND user_id = ?
    )
  `);

  subtaskDelete = db.prepare(`
    DELETE FROM subtasks
    WHERE id = ? AND todo_id = ? AND todo_id IN (
      SELECT id
      FROM todos
      WHERE id = ? AND user_id = ?
    )
  `);

  subtaskCreateTransactional = db.transaction((input: {
    todoId: number;
    userId: number;
    title: string;
    nowIso: string;
  }) => {
    const todo = todoSelectByIdAndUser!.get(input.todoId, input.userId) as Todo | undefined;
    if (!todo) {
      return null;
    }

    const nextPositionRow = subtaskSelectNextPositionByTodo!.get(input.todoId) as {
      next_position: number;
    };

    const info = subtaskInsert!.run(
      input.todoId,
      input.title,
      0,
      nextPositionRow.next_position,
      input.nowIso,
      input.nowIso,
    );

    const created = subtaskSelectByIdForTodoAndUser!.get(
      Number(info.lastInsertRowid),
      input.todoId,
      input.userId,
    ) as Subtask | undefined;

    return created ?? null;
  });
} catch (error) {
  dbError = error instanceof Error ? error : new Error('Failed to initialize database');
  db = null;
}

export const userDB = {
  findByUsername(username: string): User | null {
    if (!db) {
      console.warn('[UserDB] Database unavailable, returning mock user for:', username);
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
      if (!mockTodosStore.has(userId)) {
        mockTodosStore.set(userId, []);
      }

      console.warn('[TodoDB] Database unavailable, using mock storage for user:', userId);
      const todos = mockTodosStore.get(userId) ?? [];
      return todos.map((todo) => {
        const subtasks = (mockSubtasksStore.get(todo.id) ?? []).slice().sort((a, b) => a.position - b.position || a.id - b.id);
        return enrichTodoWithSubtasks(todo, subtasks);
      });
    }

    const todos = todoSelectAllByUser!.all(userId) as Todo[];
    return todos.map((todo) => {
      const subtasks = subtaskSelectByTodoAndUser!.all(todo.id, userId) as Subtask[];
      return enrichTodoWithSubtasks(todo, subtasks);
    });
  },

  findByIdForUser(id: number, userId: number): Todo | null {
    if (!db) {
      const todos = mockTodosStore.get(userId) ?? [];
      const todo = todos.find((item) => item.id === id);
      if (!todo) {
        return null;
      }

      const subtasks = (mockSubtasksStore.get(todo.id) ?? []).slice().sort((a, b) => a.position - b.position || a.id - b.id);
      return enrichTodoWithSubtasks(todo, subtasks);
    }

    const row = todoSelectByIdAndUser!.get(id, userId) as Todo | undefined;
    if (!row) {
      return null;
    }

    const subtasks = subtaskSelectByTodoAndUser!.all(row.id, userId) as Subtask[];
    return enrichTodoWithSubtasks(row, subtasks);
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
      const todo: Todo = {
        id: nextTodoId++,
        user_id: input.userId,
        title: input.title,
        priority: input.priority,
        due_date: input.dueDate,
        reminder_minutes: input.reminderMinutes,
        last_notification_sent: null,
        recurrence_enabled: input.recurrenceEnabled ? 1 : 0,
        recurrence_pattern: input.recurrenceEnabled ? input.recurrencePattern : null,
        completed: 0,
        completed_at: null,
        created_at: nowIso,
        updated_at: nowIso,
      };
      const todos = mockTodosStore.get(input.userId) ?? [];
      mockTodosStore.set(input.userId, [...todos, todo]);
      mockSubtasksStore.set(todo.id, []);
      console.warn('[TodoDB] Database unavailable, created mock todo:', input.title);

      const createdTodo = this.findByIdForUser(todo.id, input.userId);
      if (!createdTodo) {
        throw new Error('Failed to create todo');
      }

      return createdTodo;
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
      const todo = todos.find((item) => item.id === input.id);
      if (!todo) {
        return null;
      }

      const updatedTodo: Todo = {
        ...todo,
        title: input.title,
        priority: input.priority,
        due_date: input.dueDate,
        reminder_minutes: input.reminderMinutes,
        last_notification_sent: input.lastNotificationSent,
        recurrence_enabled: input.recurrenceEnabled ? 1 : 0,
        recurrence_pattern: input.recurrenceEnabled ? input.recurrencePattern : null,
        completed: input.completed ? 1 : 0,
        completed_at: input.completedAt,
        updated_at: getSingaporeNow().toISOString(),
      };

      mockTodosStore.set(
        input.userId,
        todos.map((item) => (item.id === input.id ? updatedTodo : item)),
      );
      console.warn('[TodoDB] Database unavailable, updated mock todo:', input.id);
      return this.findByIdForUser(input.id, input.userId);
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
    if (!db) {
      const now = getSingaporeNow();
      const todos = mockTodosStore.get(userId) ?? [];
      return todos.filter((todo) =>
        shouldSendReminder({
          dueDate: todo.due_date,
          reminderMinutes: todo.reminder_minutes,
          lastNotificationSent: todo.last_notification_sent,
          now,
        }),
      );
    }

    return todoSelectPendingRemindersByUser!.all(userId) as Todo[];
  },

  claimPendingRemindersByUser(input: ClaimPendingRemindersInput): Todo[] {
    if (!db) {
      const todos = mockTodosStore.get(input.userId) ?? [];
      const claimedTodos = todos.flatMap((todo) => {
        if (
          !shouldSendReminder({
            dueDate: todo.due_date,
            reminderMinutes: todo.reminder_minutes,
            lastNotificationSent: todo.last_notification_sent,
            now: input.now,
          })
        ) {
          return [];
        }

        return [
          {
            ...todo,
            last_notification_sent: input.sentAt,
            updated_at: input.sentAt,
          },
        ];
      });

      if (claimedTodos.length === 0) {
        return [];
      }

      const claimedTodoMap = new Map(claimedTodos.map((todo) => [todo.id, todo]));
      mockTodosStore.set(
        input.userId,
        todos.map((todo) => claimedTodoMap.get(todo.id) ?? todo),
      );

      return claimedTodos;
    }

    return todoClaimPendingRemindersByUser!(input);
  },

  markReminderSent(id: number, userId: number, sentAt: string): boolean {
    if (!db) {
      const todos = mockTodosStore.get(userId) ?? [];
      const todo = todos.find((item) => item.id === id);
      if (!todo || todo.last_notification_sent !== null) {
        return false;
      }

      mockTodosStore.set(
        userId,
        todos.map((item) =>
          item.id === id
            ? {
                ...item,
                last_notification_sent: sentAt,
                updated_at: sentAt,
              }
            : item,
        ),
      );
      return true;
    }

    const result = todoMarkReminderSent!.run(sentAt, sentAt, id, userId);
    return result.changes > 0;
  },

  delete(id: number, userId: number): boolean {
    if (!db) {
      const todos = mockTodosStore.get(userId) ?? [];
      const remainingTodos = todos.filter((todo) => todo.id !== id);
      if (remainingTodos.length === todos.length) {
        return false;
      }

      mockTodosStore.set(userId, remainingTodos);
      mockSubtasksStore.delete(id);
      console.warn('[TodoDB] Database unavailable, deleted mock todo:', id);
      return true;
    }

    const result = todoDelete!.run(id, userId);
    return result.changes > 0;
  },
};

export const subtaskDB = {
  listByTodoForUser(todoId: number, userId: number): Subtask[] {
    if (!db) {
      const todos = mockTodosStore.get(userId) ?? [];
      const todo = todos.find((item) => item.id === todoId);
      if (!todo) {
        return [];
      }

      return (mockSubtasksStore.get(todoId) ?? []).slice().sort((a, b) => a.position - b.position || a.id - b.id);
    }

    return subtaskSelectByTodoAndUser!.all(todoId, userId) as Subtask[];
  },

  create(input: {
    todoId: number;
    userId: number;
    title: string;
  }): Subtask | null {
    const trimmedTitle = input.title.trim();
    if (!trimmedTitle) {
      throw new Error('Subtask title is required');
    }

    if (!db) {
      const todos = mockTodosStore.get(input.userId) ?? [];
      const todo = todos.find((item) => item.id === input.todoId);
      if (!todo) {
        return null;
      }

      const subtasks = mockSubtasksStore.get(input.todoId) ?? [];
      const nextPosition = subtasks.length === 0 ? 1 : Math.max(...subtasks.map((subtask) => subtask.position)) + 1;
      const nowIso = getSingaporeNow().toISOString();
      const created: Subtask = {
        id: nextSubtaskId++,
        todo_id: input.todoId,
        title: trimmedTitle,
        completed: 0,
        position: nextPosition,
        created_at: nowIso,
        updated_at: nowIso,
      };

      mockSubtasksStore.set(input.todoId, [...subtasks, created]);
      return created;
    }

    return subtaskCreateTransactional!({
      todoId: input.todoId,
      userId: input.userId,
      title: trimmedTitle,
      nowIso: getSingaporeNow().toISOString(),
    });
  },

  setCompleted(input: {
    subtaskId: number;
    todoId: number;
    userId: number;
    completed: boolean;
  }): Subtask | null {
    if (!db) {
      const todos = mockTodosStore.get(input.userId) ?? [];
      const todo = todos.find((item) => item.id === input.todoId);
      if (!todo) {
        return null;
      }

      const subtasks = mockSubtasksStore.get(input.todoId) ?? [];
      const target = subtasks.find((subtask) => subtask.id === input.subtaskId);
      if (!target) {
        return null;
      }

      const nowIso = getSingaporeNow().toISOString();
      const updated: Subtask = {
        ...target,
        completed: input.completed ? 1 : 0,
        updated_at: nowIso,
      };

      mockSubtasksStore.set(
        input.todoId,
        subtasks.map((subtask) => (subtask.id === input.subtaskId ? updated : subtask)),
      );

      return updated;
    }

    const nowIso = getSingaporeNow().toISOString();
    const result = subtaskUpdateCompleted!.run(
      input.completed ? 1 : 0,
      nowIso,
      input.subtaskId,
      input.todoId,
      input.todoId,
      input.userId,
    );
    if (result.changes === 0) {
      return null;
    }

    const updated = subtaskSelectByIdForTodoAndUser!.get(
      input.subtaskId,
      input.todoId,
      input.userId,
    ) as Subtask | undefined;

    return updated ?? null;
  },

  delete(input: {
    subtaskId: number;
    todoId: number;
    userId: number;
  }): boolean {
    if (!db) {
      const todos = mockTodosStore.get(input.userId) ?? [];
      const todo = todos.find((item) => item.id === input.todoId);
      if (!todo) {
        return false;
      }

      const subtasks = mockSubtasksStore.get(input.todoId) ?? [];
      const remainingSubtasks = subtasks.filter((subtask) => subtask.id !== input.subtaskId);
      if (remainingSubtasks.length === subtasks.length) {
        return false;
      }

      mockSubtasksStore.set(input.todoId, remainingSubtasks);
      return true;
    }

    const result = subtaskDelete!.run(
      input.subtaskId,
      input.todoId,
      input.todoId,
      input.userId,
    );
    return result.changes > 0;
  },
};

if (dbError) {
  console.warn('[DB] Falling back to in-memory mock storage:', dbError.message);
}