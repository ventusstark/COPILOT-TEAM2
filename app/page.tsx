'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { formatSingaporeDate, getSingaporeNow } from '@/lib/timezone';

type Priority = 'high' | 'medium' | 'low';
type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface Todo {
  id: number;
  title: string;
  priority: Priority;
  due_date: string | null;
  completed: number;
  recurrence_enabled?: number | boolean | null;
  recurrence_pattern?: RecurrencePattern | null;
}

interface TodoApiResponse {
  success: boolean;
  data?: Todo[];
  error?: string;
}

const sectionCardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
  padding: 16,
  marginBottom: 16,
  boxShadow: '0 6px 20px rgba(17, 24, 39, 0.06)',
};

function priorityColor(priority: Priority): string {
  if (priority === 'high') return '#b91c1c';
  if (priority === 'medium') return '#FFFF00';
  return '#1d4ed8';
}

function priorityTextColor(priority: Priority): string {
  if (priority === 'medium') return '#000000';
  return '#ffffff';
}

function isRecurringEnabled(todo: Todo): boolean {
  return todo.recurrence_enabled === true || todo.recurrence_enabled === 1;
}

export default function HomePage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [createError, setCreateError] = useState('');
  const [editError, setEditError] = useState('');

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('daily');
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingPriority, setEditingPriority] = useState<Priority>('medium');
  const [editingDueDate, setEditingDueDate] = useState('');
  const [editingRepeatEnabled, setEditingRepeatEnabled] = useState(false);
  const [editingRecurrencePattern, setEditingRecurrencePattern] = useState<RecurrencePattern>('daily');

  async function loadTodos() {
    setLoading(true);
    setCreateError('');
    try {
      const response = await fetch('/api/todos');
      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        throw new Error('Unable to load todos');
      }

      const data = (await response.json()) as TodoApiResponse;
      setTodos(data.data ?? []);
    } catch {
      setCreateError('Failed to load todos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTodos();
  }, []);

  const { overdue, active, completed } = useMemo(() => {
    const now = getSingaporeNow();
    return {
      overdue: todos.filter((todo) => !todo.completed && todo.due_date && new Date(todo.due_date).getTime() < now.getTime()),
      active: todos.filter((todo) => !todo.completed && (!todo.due_date || new Date(todo.due_date).getTime() >= now.getTime())),
      completed: todos.filter((todo) => Boolean(todo.completed)),
    };
  }, [todos]);

  function validateDueDate(rawDueDate: string): string | null {
    if (!rawDueDate) {
      return null;
    }

    const parsed = new Date(rawDueDate);
    const minAllowed = new Date(getSingaporeNow().getTime() + 60_000);
    if (parsed.getTime() < minAllowed.getTime()) {
      throw new Error('Due date must be at least 1 minute in the future');
    }

    return parsed.toISOString();
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError('');

    if (!title.trim()) {
      setCreateError('Title is required');
      return;
    }

    if (repeatEnabled && !dueDate) {
      setCreateError('Recurring todos require a due date');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          priority,
          due_date: validateDueDate(dueDate),
          recurrence_enabled: repeatEnabled,
          recurrence_pattern: repeatEnabled ? recurrencePattern : null,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setCreateError(data.error ?? 'Unable to create todo');
        return;
      }

      setTitle('');
      setPriority('medium');
      setDueDate('');
      setRepeatEnabled(false);
      setRecurrencePattern('daily');
      await loadTodos();
    } catch (createError) {
      setCreateError(createError instanceof Error ? createError.message : 'Unable to create todo');
    } finally {
      setSaving(false);
    }
  }

  function startEditing(todo: Todo) {
    setEditError('');
    setEditingId(todo.id);
    setEditingTitle(todo.title);
    setEditingPriority(todo.priority);
    setEditingDueDate(todo.due_date ? todo.due_date.slice(0, 16) : '');
    const todoRepeatEnabled = isRecurringEnabled(todo);
    setEditingRepeatEnabled(todoRepeatEnabled);
    setEditingRecurrencePattern(todo.recurrence_pattern ?? 'daily');
  }

  async function handleSaveEdit(todoId: number) {
    setEditError('');
    if (!editingTitle.trim()) {
      setEditError('Title is required');
      return;
    }

    if (editingRepeatEnabled && !editingDueDate) {
      setEditError('Recurring todos require a due date');
      return;
    }

    try {
      const dueDateIso = editingDueDate ? validateDueDate(editingDueDate) : null;
      const response = await fetch(`/api/todos/${todoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingTitle.trim(),
          priority: editingPriority,
          due_date: dueDateIso,
          recurrence_enabled: editingRepeatEnabled,
          recurrence_pattern: editingRepeatEnabled ? editingRecurrencePattern : null,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setEditError(data.error ?? 'Unable to update todo');
        return;
      }

      setEditError('');
      setEditingId(null);
      await loadTodos();
    } catch (updateError) {
      setEditError(updateError instanceof Error ? updateError.message : 'Unable to update todo');
    }
  }

  async function toggleComplete(todo: Todo) {
    setCreateError('');
    try {
      const response = await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !Boolean(todo.completed) }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setCreateError(data.error ?? 'Unable to update todo');
        return;
      }

      await loadTodos();
    } catch {
      setCreateError('Unable to update todo');
    }
  }

  async function deleteTodo(todoId: number) {
    setCreateError('');
    const response = await fetch(`/api/todos/${todoId}`, { method: 'DELETE' });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setCreateError(data.error ?? 'Unable to delete todo');
      return;
    }

    setTodos((prev) => prev.filter((todo) => todo.id !== todoId));
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  function renderTodoItem(todo: Todo) {
    const isEditing = editingId === todo.id;
    return (
      <li
        key={todo.id}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 12,
          borderRadius: 10,
          border: '1px solid #e5e7eb',
          marginBottom: 10,
          backgroundColor: '#f9fafb',
        }}
      >
        {isEditing ? (
          <>
            <input
              aria-label="Edit title"
              value={editingTitle}
              onChange={(event) => {
                setEditError('');
                setEditingTitle(event.target.value);
              }}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db' }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select
                aria-label="Edit priority"
                value={editingPriority}
                onChange={(event) => {
                  setEditError('');
                  setEditingPriority(event.target.value as Priority);
                }}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db' }}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <input
                aria-label="Edit due date"
                type="datetime-local"
                value={editingDueDate}
                onChange={(event) => {
                  setEditError('');
                  setEditingDueDate(event.target.value);
                }}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db' }}
              />
              <button
                type="button"
                onClick={() => {
                  setEditError('');
                  setEditingRepeatEnabled((prev) => !prev);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  backgroundColor: editingRepeatEnabled ? '#dcfce7' : '#fff',
                  color: '#111827',
                }}
              >
                Repeat: {editingRepeatEnabled ? 'On' : 'Off'}
              </button>
              <select
                aria-label="Edit recurrence pattern"
                value={editingRecurrencePattern}
                disabled={!editingRepeatEnabled}
                onChange={(event) => {
                  setEditError('');
                  setEditingRecurrencePattern(event.target.value as RecurrencePattern);
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  backgroundColor: editingRepeatEnabled ? '#fff' : '#f3f4f6',
                }}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              <button
                type="button"
                onClick={() => void handleSaveEdit(todo.id)}
                style={{
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: 8,
                  backgroundColor: '#047857',
                  color: '#fff',
                }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditError('');
                  setEditingId(null);
                }}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  backgroundColor: '#fff',
                }}
              >
                Cancel
              </button>
            </div>
            {editError ? <p style={{ color: '#b91c1c', margin: 0 }}>{editError}</p> : null}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
                  {todo.title}
                </strong>
                <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: priorityTextColor(todo.priority),
                      backgroundColor: priorityColor(todo.priority),
                      padding: '2px 8px',
                      borderRadius: 999,
                      textTransform: 'uppercase',
                    }}
                  >
                    {todo.priority}
                  </span>
                  {isRecurringEnabled(todo) ? (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#065f46',
                        backgroundColor: '#d1fae5',
                        padding: '2px 8px',
                        borderRadius: 999,
                        textTransform: 'uppercase',
                      }}
                    >
                      Repeat {todo.recurrence_pattern ?? 'daily'}
                    </span>
                  ) : null}
                  {todo.due_date ? (
                    <span style={{ color: '#374151', fontSize: 13 }}>Due: {formatSingaporeDate(todo.due_date)}</span>
                  ) : (
                    <span style={{ color: '#6b7280', fontSize: 13 }}>No due date</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  disabled={Boolean(todo.completed)}
                  onClick={() => void toggleComplete(todo)}
                  style={{
                    border: 'none',
                    borderRadius: 8,
                    padding: '6px 10px',
                    backgroundColor: todo.completed ? '#94a3b8' : '#0369a1',
                    color: '#fff',
                    cursor: todo.completed ? 'not-allowed' : 'pointer',
                  }}
                >
                  {todo.completed ? 'Uncomplete' : 'Complete'}
                </button>
                <button
                  type="button"
                  onClick={() => startEditing(todo)}
                  style={{
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    padding: '6px 10px',
                    backgroundColor: '#fff',
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void deleteTodo(todo.id)}
                  style={{
                    border: 'none',
                    borderRadius: 8,
                    padding: '6px 10px',
                    backgroundColor: '#b91c1c',
                    color: '#fff',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </>
        )}
      </li>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '32px 16px 48px',
        background: 'radial-gradient(circle at top left, #cce3db, #f5f7fb 45%)',
      }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h1 style={{ margin: 0, fontSize: 32 }}>Todo Dashboard</h1>
          <button
            type="button"
            onClick={() => void handleLogout()}
            style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: 8, padding: '8px 12px' }}
          >
            Logout
          </button>
        </header>

        <form onSubmit={handleCreate} style={sectionCardStyle}>
          <h2 style={{ marginTop: 0 }}>Create Todo</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr auto', gap: 8 }}>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What needs to be done?"
              aria-label="Todo title"
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #d1d5db' }}
            />
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
              aria-label="Todo priority"
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #d1d5db' }}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              aria-label="Todo due date"
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #d1d5db' }}
            />
            <button
              type="submit"
              disabled={saving}
              style={{
                border: 'none',
                borderRadius: 10,
                backgroundColor: '#0f766e',
                color: '#fff',
                padding: '10px 14px',
              }}
            >
              {saving ? 'Adding...' : 'Add'}
            </button>
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setRepeatEnabled((prev) => !prev)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                backgroundColor: repeatEnabled ? '#dcfce7' : '#fff',
                color: '#111827',
              }}
            >
              Repeat: {repeatEnabled ? 'On' : 'Off'}
            </button>
            <select
              aria-label="Todo recurrence pattern"
              value={recurrencePattern}
              disabled={!repeatEnabled}
              onChange={(event) => setRecurrencePattern(event.target.value as RecurrencePattern)}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                backgroundColor: repeatEnabled ? '#fff' : '#f3f4f6',
              }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            {repeatEnabled ? <span style={{ color: '#065f46', fontSize: 13 }}>Recurring todos require a due date.</span> : null}
          </div>
          {createError ? <p style={{ color: '#b91c1c', marginBottom: 0 }}>{createError}</p> : null}
        </form>

        {loading ? <p>Loading todos...</p> : null}

        {overdue.length > 0 ? (
          <section style={{ ...sectionCardStyle, borderColor: '#fca5a5', backgroundColor: '#fef2f2' }}>
            <h2 style={{ marginTop: 0, color: '#b91c1c' }}>Overdue ({overdue.length})</h2>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{overdue.map(renderTodoItem)}</ul>
          </section>
        ) : null}

        <section style={sectionCardStyle}>
          <h2 style={{ marginTop: 0 }}>Active ({active.length})</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{active.map(renderTodoItem)}</ul>
          {active.length === 0 ? <p style={{ color: '#6b7280', marginBottom: 0 }}>No active todos.</p> : null}
        </section>

        <section style={{ ...sectionCardStyle, borderColor: '#86efac', backgroundColor: '#f0fdf4' }}>
          <h2 style={{ marginTop: 0, color: '#15803d' }}>Completed ({completed.length})</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{completed.map(renderTodoItem)}</ul>
          {completed.length === 0 ? <p style={{ color: '#6b7280', marginBottom: 0 }}>No completed todos.</p> : null}
        </section>
      </div>
    </main>
  );
}