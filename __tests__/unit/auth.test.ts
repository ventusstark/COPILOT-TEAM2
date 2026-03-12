import { describe, expect, test } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  clearSessionCookieOnResponse,
  createSession,
  getSessionFromRequest,
  setSessionCookieOnResponse,
} from '@/lib/auth';

describe('auth utilities', () => {
  test('createSession and getSessionFromRequest return session payload', async () => {
    const token = await createSession(42, 'alice');
    const request = new NextRequest('http://localhost', {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });

    const session = await getSessionFromRequest(request);
    expect(session).toEqual({ userId: 42, username: 'alice' });
  });

  test('getSessionFromRequest returns null for invalid token', async () => {
    const request = new NextRequest('http://localhost', {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=invalid-token`,
      },
    });

    const session = await getSessionFromRequest(request);
    expect(session).toBeNull();
  });

  test('setSessionCookieOnResponse writes session cookie header', async () => {
    const token = await createSession(7, 'cookie-user');
    const response = NextResponse.json({ ok: true });
    setSessionCookieOnResponse(response, token);

    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie.toLowerCase()).toContain('httponly');
  });

  test('clearSessionCookieOnResponse clears session cookie header', () => {
    const response = NextResponse.json({ ok: true });
    clearSessionCookieOnResponse(response);

    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
  });
});
