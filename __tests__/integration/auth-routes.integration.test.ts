import { describe, expect, test } from 'vitest';
import { POST as loginPost } from '@/app/api/auth/login/route';
import { POST as logoutPost } from '@/app/api/auth/logout/route';
import { userDB } from '@/lib/db';

describe('auth route integration', () => {
  test('login returns 400 for invalid username payload', async () => {
    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '   ' }),
    });

    const response = await loginPost(request as never);
    const body = (await response.json()) as { success: boolean; error?: string };

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  test('login creates or finds user and sets session cookie', async () => {
    const username = `route_user_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });

    const response = await loginPost(request as never);
    const body = (await response.json()) as {
      success: boolean;
      data?: { userId: number; username: string };
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data?.username).toBe(username);

    const persisted = userDB.findByUsername(username);
    expect(persisted?.username).toBe(username);

    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('todo_session=');
  });

  test('logout clears session cookie', async () => {
    const response = await logoutPost();
    const body = (await response.json()) as { success: boolean };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('todo_session=');
  });
});
