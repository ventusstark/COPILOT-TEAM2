import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { type Priority, todoDB } from '@/lib/db';
import { reminderMinutesSchema, type ReminderMinutes } from '@/lib/reminders';
import { getSingaporeNow } from '@/lib/timezone';

const updateTodoSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(500).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  due_date: z.string().datetime().nullable().optional(),
  reminder_minutes: reminderMinutesSchema.nullable().optional(),
  completed: z.boolean().optional(),
});

function parseTodoId(id: string): number | null {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function ensureFutureDueDate(dueDate: string | null): string | null {
  if (dueDate === null) {
    return null;
  }

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) {
    throw new Error('Due date is invalid');
  }

  const minAllowed = new Date(getSingaporeNow().getTime() + 60_000);
  if (due.getTime() < minAllowed.getTime()) {
    throw new Error('Due date must be at least 1 minute in the future');
  }

  return due.toISOString();
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todoId = parseTodoId(id);
  if (!todoId) {
    return NextResponse.json({ success: false, error: 'Invalid todo id' }, { status: 400 });
  }

  const todo = todoDB.findByIdForUser(todoId, session.userId);
  if (!todo) {
    return NextResponse.json({ success: false, error: 'Todo not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: todo });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todoId = parseTodoId(id);
  if (!todoId) {
    return NextResponse.json({ success: false, error: 'Invalid todo id' }, { status: 400 });
  }

  const existing = todoDB.findByIdForUser(todoId, session.userId);
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Todo not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = updateTodoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }

    const wasCompleted = existing.completed === 1;
    const completed = parsed.data.completed ?? wasCompleted;
    const completedAt = completed
      ? wasCompleted && parsed.data.completed === undefined
        ? existing.completed_at
        : getSingaporeNow().toISOString()
      : null;
    const dueDate =
      parsed.data.due_date === undefined
        ? existing.due_date
        : ensureFutureDueDate(parsed.data.due_date);
    let reminderMinutes =
      parsed.data.reminder_minutes === undefined
        ? existing.reminder_minutes ?? null
        : parsed.data.reminder_minutes;

    if (!dueDate) {
      reminderMinutes = null;
    }

    const dueDateChanged = dueDate !== existing.due_date;
    const reminderChanged = reminderMinutes !== (existing.reminder_minutes ?? null);
    const lastNotificationSent = dueDateChanged || reminderChanged ? null : existing.last_notification_sent ?? null;

    const updated = todoDB.update({
      id: todoId,
      userId: session.userId,
      title: parsed.data.title ?? existing.title,
      priority: (parsed.data.priority ?? existing.priority) as Priority,
      dueDate,
      reminderMinutes: reminderMinutes as ReminderMinutes | null,
      lastNotificationSent,
      completed,
      completedAt,
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Todo not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update todo';
    const status = message.includes('Due date') ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todoId = parseTodoId(id);
  if (!todoId) {
    return NextResponse.json({ success: false, error: 'Invalid todo id' }, { status: 400 });
  }

  const deleted = todoDB.delete(todoId, session.userId);
  if (!deleted) {
    return NextResponse.json({ success: false, error: 'Todo not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}