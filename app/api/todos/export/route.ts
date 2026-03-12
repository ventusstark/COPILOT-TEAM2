import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { todoDB } from '@/lib/db';
import { getSingaporeNow } from '@/lib/timezone';

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const format = request.nextUrl.searchParams.get('format') ?? 'json';
  const todos = todoDB.listByUserId(session.userId);
  const dateStamp = getSingaporeNow().toISOString().slice(0, 10);

  if (format === 'csv') {
    const headers = [
      'title',
      'priority',
      'due_date',
      'completed',
      'recurrence_enabled',
      'recurrence_pattern',
      'reminder_minutes',
      'created_at',
      'updated_at',
    ];

    const rows = todos.map((todo) => [
      todo.title,
      todo.priority,
      todo.due_date ?? '',
      String(todo.completed),
      String(todo.recurrence_enabled),
      todo.recurrence_pattern ?? '',
      todo.reminder_minutes === null ? '' : String(todo.reminder_minutes),
      todo.created_at,
      todo.updated_at,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => csvEscape(cell)).join(','))
      .join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="todos-${dateStamp}.csv"`,
      },
    });
  }

  if (format !== 'json') {
    return NextResponse.json({ success: false, error: 'Unsupported format' }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: { todos } }, {
    status: 200,
    headers: {
      'Content-Disposition': `attachment; filename="todos-${dateStamp}.json"`,
    },
  });
}
