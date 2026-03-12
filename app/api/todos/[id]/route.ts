import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { type Priority, type RecurrencePattern, todoDB } from '@/lib/db';
import { reminderMinutesSchema, type ReminderMinutes } from '@/lib/reminders';
import { getSingaporeNow } from '@/lib/timezone';

const updateTodoSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(500).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  due_date: z.string().datetime().nullable().optional(),
  reminder_minutes: reminderMinutesSchema.nullable().optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  recurrence_enabled: z.boolean().optional(),
  recurrence_pattern: z.enum(['daily', 'weekly', 'monthly', 'yearly']).nullable().optional(),
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

function singaporeDateTimeParts(input: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(input).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function toIsoInSingapore(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}): string {
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  const hour = String(parts.hour).padStart(2, '0');
  const minute = String(parts.minute).padStart(2, '0');
  const second = String(parts.second).padStart(2, '0');
  return `${parts.year}-${month}-${day}T${hour}:${minute}:${second}+08:00`;
}

function computeNextRecurringDueDate(dueDate: string, pattern: RecurrencePattern): string {
  const base = new Date(dueDate);
  if (Number.isNaN(base.getTime())) {
    throw new Error('Due date is invalid');
  }

  if (pattern === 'daily') {
    return new Date(base.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }

  if (pattern === 'weekly') {
    return new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  const baseParts = singaporeDateTimeParts(base);
  const currentMonthIndex = baseParts.month - 1;

  const targetMonthCursor =
    pattern === 'monthly'
      ? new Date(Date.UTC(baseParts.year, currentMonthIndex + 1, 1))
      : new Date(Date.UTC(baseParts.year + 1, currentMonthIndex, 1));

  const targetYear = targetMonthCursor.getUTCFullYear();
  const targetMonthIndex = targetMonthCursor.getUTCMonth();
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const targetDay = Math.min(baseParts.day, daysInTargetMonth);

  return new Date(
    toIsoInSingapore({
      year: targetYear,
      month: targetMonthIndex + 1,
      day: targetDay,
      hour: baseParts.hour,
      minute: baseParts.minute,
      second: baseParts.second,
    }),
  ).toISOString();
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

    const dueDate =
      parsed.data.due_date === undefined
        ? existing.due_date
        : ensureFutureDueDate(parsed.data.due_date);

    const recurrenceEnabled =
      parsed.data.recurrence_enabled === undefined
        ? existing.recurrence_enabled === 1
        : parsed.data.recurrence_enabled;

    if (recurrenceEnabled && !dueDate) {
      return NextResponse.json({ success: false, error: 'Recurring todos require a due date' }, { status: 400 });
    }

    const recurrencePattern: RecurrencePattern | null = recurrenceEnabled
      ? (parsed.data.recurrence_pattern ?? existing.recurrence_pattern ?? 'daily') as RecurrencePattern
      : null;

    const wasCompleted = existing.completed === 1;
    const completed = parsed.data.completed ?? wasCompleted;
    const shouldCreateNextOccurrence = recurrenceEnabled && !wasCompleted && completed;
    const completedAt = completed
      ? wasCompleted && parsed.data.completed === undefined
        ? existing.completed_at
        : getSingaporeNow().toISOString()
      : null;
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
      recurrenceEnabled,
      recurrencePattern,
      reminderMinutes: reminderMinutes as ReminderMinutes | null,
      lastNotificationSent,
      completed,
      completedAt,
      tagIds: parsed.data.tag_ids,
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Todo not found' }, { status: 404 });
    }

    if (shouldCreateNextOccurrence && dueDate && recurrencePattern) {
      const nextDueDate = computeNextRecurringDueDate(dueDate, recurrencePattern);
      todoDB.create({
        userId: session.userId,
        title: updated.title,
        priority: updated.priority as Priority,
        dueDate: nextDueDate,
        reminderMinutes: (updated.reminder_minutes ?? null) as ReminderMinutes | null,
        tagIds: (updated.tags ?? []).map((tag) => tag.id),
        recurrenceEnabled: true,
        recurrencePattern,
      });
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