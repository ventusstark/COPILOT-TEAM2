import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { templateDB } from '@/lib/db';

function parseId(id: string): number | null {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
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
  const templateId = parseId(id);
  if (!templateId) {
    return NextResponse.json({ success: false, error: 'Invalid template id' }, { status: 400 });
  }

  const deleted = templateDB.delete(templateId, session.userId);
  if (!deleted) {
    return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
