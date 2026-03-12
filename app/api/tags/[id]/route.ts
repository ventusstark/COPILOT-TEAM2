import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { tagDB } from '@/lib/db';

const updateTagSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/),
});

function parseId(id: string): number | null {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
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
  const tagId = parseId(id);
  if (!tagId) {
    return NextResponse.json({ success: false, error: 'Invalid tag id' }, { status: 400 });
  }

  const body = await request.json();
  const parsed = updateTagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  }

  try {
    const updated = tagDB.update({
      id: tagId,
      userId: session.userId,
      name: parsed.data.name,
      color: parsed.data.color,
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Tag not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update tag';
    const status = message.includes('UNIQUE') ? 409 : 400;
    return NextResponse.json({ success: false, error: message.includes('UNIQUE') ? 'Tag name must be unique' : message }, { status });
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
  const tagId = parseId(id);
  if (!tagId) {
    return NextResponse.json({ success: false, error: 'Invalid tag id' }, { status: 400 });
  }

  const deleted = tagDB.delete(tagId, session.userId);
  if (!deleted) {
    return NextResponse.json({ success: false, error: 'Tag not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
