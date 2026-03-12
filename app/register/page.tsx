'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  startRegistration,
  browserSupportsWebAuthnAutofill,
} from '@simplewebauthn/browser';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [supportsWebAuthn, setSupportsWebAuthn] = useState(true);

  // Check browser support on mount
  if (typeof window !== 'undefined' && !supportsWebAuthn) {
    // This will run on the client
    const checkSupport = async () => {
      const supported = await browserSupportsWebAuthnAutofill();
      setSupportsWebAuthn(supported);
    };
    checkSupport().catch(() => {
      setSupportsWebAuthn(false);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError('Username is required');
      return;
    }

    setLoading(true);

    try {
      // Step 1: Get registration options from server
      const optionsResponse = await fetch('/api/auth/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUsername }),
      });

      if (!optionsResponse.ok) {
        const data = (await optionsResponse.json()) as { error?: string };
        setError(data.error ?? 'Failed to start registration');
        setLoading(false);
        return;
      }

      const { options } = (await optionsResponse.json()) as {
        options: unknown;
      };

      // Step 2: Invoke the authenticator
      let attResp;
      try {
        attResp = await startRegistration(options as any);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'User cancelled registration or authenticator not available';
        setError(errorMsg);
        setLoading(false);
        return;
      }

      // Step 3: Verify the response on the server
      const verifyResponse = await fetch('/api/auth/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: trimmedUsername,
          response: attResp,
        }),
      });

      if (!verifyResponse.ok) {
        const data = (await verifyResponse.json()) as { error?: string };
        setError(data.error ?? 'Registration failed');
        setLoading(false);
        return;
      }

      // Success - redirect to home
      router.push('/');
      router.refresh();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Registration failed';
      setError(errorMsg);
    } finally {
      setLoading(false);
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
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          padding: 32,
          borderRadius: 12,
          background: 'rgba(30, 41, 59, 0.5)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 8px 0', fontSize: 28, color: '#e2e8f0' }}>
            Register
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: '#94a3b8' }}>
            Create an account with passkeys
          </p>
        </div>

        {!supportsWebAuthn && (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              fontSize: 13,
            }}
          >
            Your browser does not support WebAuthn. Please use a modern browser like Chrome, Firefox, Edge, or Safari.
          </div>
        )}

        {error && (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label htmlFor="username" style={{ fontSize: 14, fontWeight: 500, color: '#cbd5e1' }}>
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter a username"
              disabled={loading}
              style={{
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid rgba(148, 163, 184, 0.3)',
                background: 'rgba(15, 23, 42, 0.5)',
                color: '#e2e8f0',
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.6)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.3)';
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !supportsWebAuthn}
            style={{
              padding: '10px 16px',
              borderRadius: 6,
              border: 'none',
              background: loading ? 'rgba(59, 130, 246, 0.5)' : 'rgb(59, 130, 246)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading && supportsWebAuthn) {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgb(37, 99, 235)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && supportsWebAuthn) {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgb(59, 130, 246)';
              }
            }}
          >
            {loading ? 'Registering...' : 'Register with Passkey'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>
          Already have an account?{' '}
          <a
            href="/login"
            style={{
              color: 'rgb(59, 130, 246)',
              textDecoration: 'none',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            Log in
          </a>
        </div>
      </div>
    </main>
  );
}
