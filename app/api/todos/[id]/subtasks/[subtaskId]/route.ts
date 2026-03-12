import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { subtaskDB, todoDB } from '@/lib/db';

const updateSubtaskSchema = z.object({
  completed: z.boolean(),
});

function parsePositiveId(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subtaskId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id, subtaskId } = await params;
  const todoId = parsePositiveId(id);
  const parsedSubtaskId = parsePositiveId(subtaskId);
  if (!todoId || !parsedSubtaskId) {
    return NextResponse.json({ success: false, error: 'Invalid subtask id' }, { status: 400 });
  }

  const existingTodo = todoDB.findByIdForUser(todoId, session.userId);
  if (!existingTodo) {
    return NextResponse.json({ success: false, error: 'Todo not found' }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateSubtaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    );
  }

  const updatedSubtask = subtaskDB.setCompleted({
    subtaskId: parsedSubtaskId,
    todoId,
    userId: session.userId,
    completed: parsed.data.completed,
  });

  if (!updatedSubtask) {
    return NextResponse.json({ success: false, error: 'Subtask not found' }, { status: 404 });
  }

  const updatedTodo = todoDB.findByIdForUser(todoId, session.userId);
  if (!updatedTodo) {
    return NextResponse.json({ success: false, error: 'Todo not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: updatedTodo });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; subtaskId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id, subtaskId } = await params;
  const todoId = parsePositiveId(id);
  const parsedSubtaskId = parsePositiveId(subtaskId);
  if (!todoId || !parsedSubtaskId) {
    return NextResponse.json({ success: false, error: 'Invalid subtask id' }, { status: 400 });
  }

  const existingTodo = todoDB.findByIdForUser(todoId, session.userId);
  if (!existingTodo) {
    return NextResponse.json({ success: false, error: 'Todo not found' }, { status: 404 });
  }

  const deleted = subtaskDB.delete({
    subtaskId: parsedSubtaskId,
    todoId,
    userId: session.userId,
  });

  if (!deleted) {
    return NextResponse.json({ success: false, error: 'Subtask not found' }, { status: 404 });
  }

  const updatedTodo = todoDB.findByIdForUser(todoId, session.userId);
  if (!updatedTodo) {
    return NextResponse.json({ success: false, error: 'Todo not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: updatedTodo });
}
