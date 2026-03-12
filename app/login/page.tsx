'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
      setError('Login failed');
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
        background: 'linear-gradient(145deg, rgba(17, 24, 39, 0.78), rgba(2, 6, 23, 0.94))',
      }}
    >
      <form
        onSubmit={handleSubmit}
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
          Enter your username to sign in or create an account.
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