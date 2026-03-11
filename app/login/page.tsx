'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? 'Login failed');
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Unable to login right now');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'linear-gradient(145deg, #f4f7fb, #dbe4ef)',
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: '#ffffff',
          borderRadius: 16,
          border: '1px solid #d1d5db',
          padding: 24,
          boxShadow: '0 8px 30px rgba(17, 24, 39, 0.08)',
        }}
      >
        <h1 style={{ margin: 0, marginBottom: 10, fontSize: 28 }}>Login</h1>
        <p style={{ marginTop: 0, marginBottom: 16, color: '#4b5563' }}>
          Enter a username to start managing todos.
        </p>
        <label htmlFor="username" style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
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
            border: '1px solid #d1d5db',
            marginBottom: 12,
          }}
        />
        {error ? <p style={{ color: '#b91c1c', marginTop: 0 }}>{error}</p> : null}
        <button
          type="submit"
          disabled={submitting}
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
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </main>
  );
}