'use client';

import { FormEvent, useState } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState<'register' | 'login' | null>(null);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    setSubmitting('register');
    try {
      const optionsResponse = await fetch('/api/auth/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      const optionsBody = (await optionsResponse.json()) as {
        success: boolean;
        data?: unknown;
        error?: string;
      };

      if (!optionsResponse.ok || !optionsBody.data) {
        setError(optionsBody.error ?? 'Unable to start registration');
        return;
      }

      const registrationResponse = await startRegistration({
        optionsJSON: optionsBody.data as Parameters<typeof startRegistration>[0]['optionsJSON'],
      });

      const verifyResponse = await fetch('/api/auth/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          response: registrationResponse,
        }),
      });

      if (!verifyResponse.ok) {
        const data = (await verifyResponse.json()) as { error?: string };
        setError(data.error ?? 'Login failed');
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Registration cancelled or failed');
    } finally {
      setSubmitting(null);
    }
  }

  async function handleLogin() {
    setError('');
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    setSubmitting('login');
    try {
      const optionsResponse = await fetch('/api/auth/login-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      const optionsBody = (await optionsResponse.json()) as {
        success: boolean;
        data?: unknown;
        error?: string;
      };

      if (!optionsResponse.ok || !optionsBody.data) {
        setError(optionsBody.error ?? 'Unable to start login');
        return;
      }

      const authResponse = await startAuthentication({
        optionsJSON: optionsBody.data as Parameters<typeof startAuthentication>[0]['optionsJSON'],
      });

      const verifyResponse = await fetch('/api/auth/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          response: authResponse,
        }),
      });

      if (!verifyResponse.ok) {
        const data = (await verifyResponse.json()) as { error?: string };
        setError(data.error ?? 'Login failed');
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Login cancelled or failed');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'linear-gradient(145deg, rgba(17, 24, 39, 0.78), rgba(2, 6, 23, 0.94))',
      }}
    >
      <form
        onSubmit={handleRegister}
        style={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: 'rgba(17, 24, 39, 0.92)',
          borderRadius: 16,
          border: '1px solid #374151',
          padding: 24,
          boxShadow: '0 8px 30px rgba(2, 6, 23, 0.6)',
        }}
      >
        <h1 style={{ margin: 0, marginBottom: 10, fontSize: 28, color: '#f9fafb' }}>Login</h1>
        <p style={{ marginTop: 0, marginBottom: 16, color: '#9ca3af' }}>
          Register or log in with a passkey.
        </p>
        <label htmlFor="username" style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#e5e7eb' }}>
          Username
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="e.g. alex"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #374151',
            backgroundColor: '#0f172a',
            color: '#f9fafb',
            marginBottom: 12,
          }}
        />
        {error ? <p style={{ color: '#b91c1c', marginTop: 0 }}>{error}</p> : null}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            type="submit"
            disabled={submitting !== null}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: 'none',
              backgroundColor: '#0f766e',
              color: '#ffffff',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting === 'register' ? 'Registering...' : 'Register'}
          </button>
          <button
            type="button"
            onClick={() => void handleLogin()}
            disabled={submitting !== null}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #0f766e',
              backgroundColor: '#0f172a',
              color: '#5eead4',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting === 'login' ? 'Signing in...' : 'Login'}
          </button>
        </div>
      </form>
    </main>
  );
}