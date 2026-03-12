'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatSingaporeDate, getSingaporeNow } from '@/lib/timezone';

type Priority = 'high' | 'medium' | 'low';

type Todo = {
  id: number;
  title: string;
  due_date: string | null;
  priority: Priority;
};

type Holiday = {
  id: number;
  date: string;
  name: string;
};

const SINGAPORE_TZ = 'Asia/Singapore';

function toSgDateKey(input: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SINGAPORE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(typeof input === 'string' ? new Date(input) : input);
}

function getSgMonth(input: Date): number {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: SINGAPORE_TZ,
    month: 'numeric',
  }).format(input));
}

function getSgDayOfMonth(input: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: SINGAPORE_TZ,
    day: 'numeric',
  }).format(input);
}

function buildMonthGrid(year: number, month: number): Date[] {
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const startWeekday = firstDay.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const dates: Date[] = [];
  for (let i = 0; i < startWeekday; i += 1) {
    dates.push(new Date(Date.UTC(year, month - 1, i - startWeekday + 1)));
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    dates.push(new Date(Date.UTC(year, month - 1, day)));
  }

  while (dates.length % 7 !== 0) {
    const nextIndex = dates.length - startWeekday - daysInMonth + 1;
    dates.push(new Date(Date.UTC(year, month, nextIndex)));
  }

  return dates;
}

export default function CalendarPage() {
  const now = getSingaporeNow();
  const [year, setYear] = useState(Number(new Intl.DateTimeFormat('en-US', { timeZone: SINGAPORE_TZ, year: 'numeric' }).format(now)));
  const [month, setMonth] = useState(Number(new Intl.DateTimeFormat('en-US', { timeZone: SINGAPORE_TZ, month: 'numeric' }).format(now)));
  const [todos, setTodos] = useState<Todo[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setError('');
      const response = await fetch(`/api/calendar?year=${year}&month=${month}`);
      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        setError('Unable to load calendar data');
        return;
      }

      const body = (await response.json()) as { data?: { todos?: Todo[]; holidays?: Holiday[] } };
      setTodos(body.data?.todos ?? []);
      setHolidays(body.data?.holidays ?? []);
    }

    void load();
  }, [year, month]);

  const monthGrid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const todosByDate = useMemo(() => {
    const map = new Map<string, Todo[]>();
    for (const todo of todos) {
      if (!todo.due_date) {
        continue;
      }
      const key = toSgDateKey(todo.due_date);
      map.set(key, [...(map.get(key) ?? []), todo]);
    }
    return map;
  }, [todos]);

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, Holiday[]>();
    for (const holiday of holidays) {
      const key = toSgDateKey(holiday.date);
      map.set(key, [...(map.get(key) ?? []), holiday]);
    }
    return map;
  }, [holidays]);

  function moveMonth(delta: number) {
    const cursor = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(cursor.getUTCFullYear());
    setMonth(cursor.getUTCMonth() + 1);
  }

  const todayKey = toSgDateKey(now);

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '32px 16px',
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.76), rgba(2, 6, 23, 0.94))',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30 }}>Calendar</h1>
            <p style={{ margin: 0, color: '#9ca3af' }}>
              {new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-SG', {
                timeZone: SINGAPORE_TZ,
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => moveMonth(-1)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#111827', color: '#e5e7eb' }}>
              Previous
            </button>
            <button
              type="button"
              onClick={() => {
                const nowDate = getSingaporeNow();
                setYear(Number(new Intl.DateTimeFormat('en-US', { timeZone: SINGAPORE_TZ, year: 'numeric' }).format(nowDate)));
                setMonth(Number(new Intl.DateTimeFormat('en-US', { timeZone: SINGAPORE_TZ, month: 'numeric' }).format(nowDate)));
              }}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#111827', color: '#e5e7eb' }}
            >
              Today
            </button>
            <button type="button" onClick={() => moveMonth(1)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#111827', color: '#e5e7eb' }}>
              Next
            </button>
            <a href="/" style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', textDecoration: 'none', color: '#e5e7eb', backgroundColor: '#111827' }}>
              Back to Todos
            </a>
          </div>
        </header>

        {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} style={{ fontWeight: 700, textAlign: 'center', color: '#cbd5e1' }}>{day}</div>
          ))}

          {monthGrid.map((date) => {
            const key = toSgDateKey(date);
            const dayTodos = todosByDate.get(key) ?? [];
            const dayHolidays = holidaysByDate.get(key) ?? [];
            const isToday = key === todayKey;
            const inCurrentMonth = getSgMonth(date) === month;
            const past = new Date(`${key}T00:00:00+08:00`).getTime() < new Date(`${todayKey}T00:00:00+08:00`).getTime();

            return (
              <div
                key={key}
                style={{
                  minHeight: 140,
                  borderRadius: 12,
                  border: isToday ? '2px solid #14b8a6' : '1px solid #334155',
                  backgroundColor: inCurrentMonth ? '#111827' : '#0f172a',
                  opacity: past ? 0.8 : 1,
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <strong style={{ color: '#f3f4f6' }}>{getSgDayOfMonth(date)}</strong>
                {dayHolidays.map((holiday) => (
                  <span key={holiday.id} style={{ fontSize: 12, borderRadius: 999, padding: '2px 8px', backgroundColor: '#fee2e2', color: '#991b1b' }}>
                    {holiday.name}
                  </span>
                ))}
                {dayTodos.map((todo) => {
                  const color = todo.priority === 'high' ? '#ef4444' : todo.priority === 'medium' ? '#eab308' : '#3b82f6';
                  return (
                    <div key={todo.id} style={{ borderLeft: `4px solid ${color}`, backgroundColor: '#1f2937', borderRadius: 6, padding: '4px 6px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{todo.title}</div>
                      {todo.due_date ? <div style={{ fontSize: 11, color: '#cbd5e1' }}>{formatSingaporeDate(todo.due_date)}</div> : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
