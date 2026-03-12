import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { tagDB } from '@/lib/db';

const createTagSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const tags = tagDB.listByUserId(session.userId);
  return NextResponse.json({ success: true, data: tags });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createTagSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }

    const tag = tagDB.create({
      userId: session.userId,
      name: parsed.data.name,
      color: parsed.data.color,
    });

    return NextResponse.json({ success: true, data: tag }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create tag';
    const status = message.includes('UNIQUE') ? 409 : 400;
    return NextResponse.json({ success: false, error: message.includes('UNIQUE') ? 'Tag name must be unique' : message }, { status });
  }
}
