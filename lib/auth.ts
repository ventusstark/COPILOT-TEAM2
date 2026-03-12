import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export const SESSION_COOKIE_NAME = 'todo_session';
const SESSION_EXPIRY_DAYS = 7;

function getJwtSecret(): string {
  const configuredSecret = process.env.JWT_SECRET;
  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production');
  }

  return 'dev-only-secret-change-me';
}

export interface Session {
  userId: number;
  username: string;
}

interface SessionPayload {
  userId: number;
  username: string;
}

function getExpiryDate(): Date {
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_EXPIRY_DAYS);
  return expires;
}

export async function createSession(userId: number, username: string): Promise<string> {
  const payload: SessionPayload = { userId, username };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: `${SESSION_EXPIRY_DAYS}d` });
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: getExpiryDate(),
  });
}

export function setSessionCookieOnResponse(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: getExpiryDate(),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export function clearSessionCookieOnResponse(response: NextResponse): void {
  response.cookies.delete(SESSION_COOKIE_NAME);
}

function parseSessionToken(token: string | undefined): Session | null {
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as SessionPayload;
    return {
      userId: payload.userId,
      username: payload.username,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return parseSessionToken(token);
}

export async function getSessionFromRequest(request: NextRequest): Promise<Session | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return parseSessionToken(token);
}
