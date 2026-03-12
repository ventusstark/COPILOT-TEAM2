import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { subtaskDB, todoDB } from '@/lib/db';

const createSubtaskSchema = z.object({
  title: z.string().trim().min(1, 'Subtask title is required').max(500),
});

function parsePositiveId(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todoId = parsePositiveId(id);
  if (!todoId) {
    return NextResponse.json({ success: false, error: 'Invalid todo id' }, { status: 400 });
  }

  const existingTodo = todoDB.findByIdForUser(todoId, session.userId);
  if (!existingTodo) {
    return NextResponse.json({ success: false, error: 'Todo not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = createSubtaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 },
      );
    }

    const existingSubtasks = subtaskDB.listByTodoId(todoId, session.userId);
    const nextPosition =
      existingSubtasks.length === 0
        ? 1
        : Math.max(...existingSubtasks.map((subtask) => subtask.position)) + 1;

    const created = subtaskDB.create({
      todoId,
      userId: session.userId,
      title: parsed.data.title,
      position: nextPosition,
    });

    if (!created) {
      return NextResponse.json({ success: false, error: 'Todo not found' }, { status: 404 });
    }

    const updatedTodo = todoDB.findByIdForUser(todoId, session.userId);
    if (!updatedTodo) {
      return NextResponse.json({ success: false, error: 'Todo not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updatedTodo }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create subtask';
    const status = message.includes('required') ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
