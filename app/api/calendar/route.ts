import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { holidayDB, todoDB } from '@/lib/db';

function getSingaporeYearMonth(input: string): { year: number; month: number } {
  const date = new Date(input);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: 'numeric',
  });

  const parts = formatter.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
  };
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const year = Number(request.nextUrl.searchParams.get('year'));
  const month = Number(request.nextUrl.searchParams.get('month'));

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ success: false, error: 'Invalid year or month' }, { status: 400 });
  }

  const todos = todoDB.listByUserId(session.userId).filter((todo) => {
    if (!todo.due_date) {
      return false;
    }
    const parts = getSingaporeYearMonth(todo.due_date);
    return parts.year === year && parts.month === month;
  });

  const holidays = holidayDB.listByMonth(year, month);
  return NextResponse.json({ success: true, data: { todos, holidays } });
}
