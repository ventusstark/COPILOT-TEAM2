import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { templateDB } from '@/lib/db';
import { reminderMinutesSchema } from '@/lib/reminders';

const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().nullable(),
  category: z.string().trim().max(100).optional().nullable(),
  title_template: z.string().trim().min(1).max(500),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  recurrence_enabled: z.boolean().optional().default(false),
  recurrence_pattern: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional().nullable(),
  reminder_minutes: reminderMinutesSchema.optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.recurrence_enabled && !data.recurrence_pattern) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Recurrence pattern is required when recurrence is enabled',
      path: ['recurrence_pattern'],
    });
  }
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const templates = templateDB.listByUserId(session.userId);
  return NextResponse.json({ success: true, data: templates });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }

    const template = templateDB.create({
      userId: session.userId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      category: parsed.data.category ?? null,
      titleTemplate: parsed.data.title_template,
      priority: parsed.data.priority,
      recurrenceEnabled: parsed.data.recurrence_enabled,
      recurrencePattern: parsed.data.recurrence_enabled ? parsed.data.recurrence_pattern ?? 'daily' : null,
      reminderMinutes: parsed.data.reminder_minutes ?? null,
    });

    return NextResponse.json({ success: true, data: template }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to create template' }, { status: 500 });
  }
}
