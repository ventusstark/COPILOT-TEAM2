import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { todoDB, templateDB, type Priority, type RecurrencePattern } from '@/lib/db';
import { type ReminderMinutes } from '@/lib/reminders';

function parseId(id: string): number | null {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const templateId = parseId(id);
  if (!templateId) {
    return NextResponse.json({ success: false, error: 'Invalid template id' }, { status: 400 });
  }

  const template = templateDB.findByIdForUser(templateId, session.userId);
  if (!template) {
    return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
  }

  const todo = todoDB.create({
    userId: session.userId,
    title: template.title_template,
    priority: template.priority as Priority,
    dueDate: null,
    reminderMinutes: null as ReminderMinutes | null,
    recurrenceEnabled: template.recurrence_enabled === 1,
    recurrencePattern: template.recurrence_enabled === 1
      ? (template.recurrence_pattern ?? 'daily') as RecurrencePattern
      : null,
  });

  return NextResponse.json({ success: true, data: todo }, { status: 201 });
}
