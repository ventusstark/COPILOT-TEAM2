import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { todoDB, type Priority, type RecurrencePattern } from '@/lib/db';
import { reminderMinutesSchema, type ReminderMinutes } from '@/lib/reminders';
import { getSingaporeNow } from '@/lib/timezone';

const importTodoSchema = z.object({
  title: z.string().trim().min(1).max(500),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  due_date: z.string().datetime().nullable().optional(),
  reminder_minutes: reminderMinutesSchema.nullable().optional(),
  recurrence_enabled: z.union([z.number().int(), z.boolean()]).optional(),
  recurrence_pattern: z.enum(['daily', 'weekly', 'monthly', 'yearly']).nullable().optional(),
  completed: z.union([z.number().int(), z.boolean()]).optional(),
  completed_at: z.string().datetime().nullable().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

const importPayloadSchema = z.object({
  todos: z.array(importTodoSchema),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = importPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid import format' }, { status: 400 });
    }

    const imported = parsed.data.todos.map((item) => {
      const recurrenceEnabled = item.recurrence_enabled === true || item.recurrence_enabled === 1;
      const completed = item.completed === true || item.completed === 1;
      const now = getSingaporeNow();
      const dueDate = item.due_date ?? null;
      const isPastDue = dueDate ? new Date(dueDate).getTime() < now.getTime() : false;

      const created = todoDB.create({
        userId: session.userId,
        title: item.title,
        priority: item.priority as Priority,
        dueDate,
        reminderMinutes: (item.reminder_minutes ?? null) as ReminderMinutes | null,
        recurrenceEnabled,
        recurrencePattern: recurrenceEnabled
          ? (item.recurrence_pattern ?? 'daily') as RecurrencePattern
          : null,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        completed,
        completedAt: completed ? item.completed_at ?? null : null,
        lastNotificationSent: completed || isPastDue ? now.toISOString() : null,
      });

      return created;
    });

    return NextResponse.json({
      success: true,
      data: {
        imported: imported.length,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to import todos' }, { status: 500 });
  }
}
