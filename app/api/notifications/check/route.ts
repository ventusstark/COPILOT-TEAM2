import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { todoDB } from '@/lib/db';
import { getSingaporeNow } from '@/lib/timezone';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const now = getSingaporeNow();
  const triggered = todoDB.claimPendingRemindersByUser({
    userId: session.userId,
    now,
    sentAt: now.toISOString(),
  });

  return NextResponse.json({ success: true, data: triggered });
}