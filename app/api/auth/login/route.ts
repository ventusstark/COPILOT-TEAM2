import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSession, setSessionCookieOnResponse } from '@/lib/auth';
import { userDB } from '@/lib/db';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(100),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid username' }, { status: 400 });
    }

    const username = parsed.data.username.trim();
    const existing = userDB.findByUsername(username);
    const user = existing ?? userDB.create(username);
    const token = await createSession(user.id, user.username);
    const response = NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        username: user.username,
      },
    });
    setSessionCookieOnResponse(response, token);

    return response;
  } catch {
    return NextResponse.json({ success: false, error: 'Login failed' }, { status: 500 });
  }
}