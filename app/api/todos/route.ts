import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { type Priority, type RecurrencePattern, todoDB } from '@/lib/db';
import { reminderMinutesSchema, type ReminderMinutes } from '@/lib/reminders';
import { getSingaporeNow } from '@/lib/timezone';

const createTodoSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(500),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  due_date: z.string().datetime().optional().nullable(),
  reminder_minutes: reminderMinutesSchema.optional().nullable(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  recurrence_enabled: z.boolean().optional().default(false),
  recurrence_pattern: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.recurrence_enabled && !data.due_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Recurring todos require a due date',
      path: ['due_date'],
    });
  }
});

function ensureFutureDueDate(dueDate: string | null | undefined): string | null {
  if (!dueDate) {
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

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const todos = todoDB.listByUserId(session.userId);
  return NextResponse.json({ success: true, data: todos });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createTodoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }

    const dueDate = ensureFutureDueDate(parsed.data.due_date);
    if (!dueDate && parsed.data.reminder_minutes !== null && parsed.data.reminder_minutes !== undefined) {
      return NextResponse.json({ success: false, error: 'Reminder requires a due date' }, { status: 400 });
    }

    const recurrenceEnabled = parsed.data.recurrence_enabled ?? false;
    const recurrencePattern: RecurrencePattern | null = recurrenceEnabled
      ? (parsed.data.recurrence_pattern ?? 'daily') as RecurrencePattern
      : null;

    const todo = todoDB.create({
      userId: session.userId,
      title: parsed.data.title,
      priority: parsed.data.priority as Priority,
      dueDate,
      reminderMinutes: (parsed.data.reminder_minutes ?? null) as ReminderMinutes | null,
      tagIds: parsed.data.tag_ids,
      recurrenceEnabled,
      recurrencePattern,
    });

    return NextResponse.json({ success: true, data: todo }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create todo';
    const status = message.includes('Due date') ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}