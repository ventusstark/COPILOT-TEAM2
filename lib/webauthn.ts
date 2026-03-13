import type { NextRequest } from 'next/server';

/**
 * Resolves WebAuthn rpID and origin from the request, handling reverse proxies.
 *
 * Precedence (highest to lowest):
 *   1. WEBAUTHN_RP_ID / WEBAUTHN_ORIGIN env vars (explicit deploy config)
 *   2. x-forwarded-host / x-forwarded-proto headers (proxy-injected)
 *   3. host header (standard HTTP/1.1)
 *   4. request.nextUrl (fallback — may be localhost behind proxy)
 *
 * Security: In production, set WEBAUTHN_RP_ID and WEBAUTHN_ORIGIN explicitly.
 * Forwarded headers can be spoofed if the app is not behind a trusted proxy.
 */

function firstValue(headerValue: string | null): string | null {
  if (!headerValue) return null;
  // x-forwarded-host/proto can be comma-separated; take the leftmost (original client)
  const first = headerValue.split(',')[0].trim();
  return first || null;
}

function stripPort(host: string): string {
  // IPv6: [::1]:3000 → ::1
  if (host.startsWith('[')) {
    const bracketEnd = host.indexOf(']');
    if (bracketEnd !== -1) {
      return host.slice(1, bracketEnd);
    }
  }
  // hostname:port → hostname
  const colonIdx = host.lastIndexOf(':');
  if (colonIdx > 0) {
    const possiblePort = host.slice(colonIdx + 1);
    if (/^\d+$/.test(possiblePort)) {
      return host.slice(0, colonIdx);
    }
  }
  return host;
}

export function resolveWebAuthnHost(request: NextRequest): string {
  const forwarded = firstValue(request.headers.get('x-forwarded-host'));
  if (forwarded) return forwarded;

  const hostHeader = request.headers.get('host');
  if (hostHeader) return hostHeader;

  return request.nextUrl.host;
}

export function resolveRpID(request: NextRequest): string {
  const envRpID = process.env.WEBAUTHN_RP_ID;
  if (envRpID) return envRpID;

  return stripPort(resolveWebAuthnHost(request));
}

export function resolveExpectedOrigin(request: NextRequest): string {
  const envOrigin = process.env.WEBAUTHN_ORIGIN;
  if (envOrigin) return envOrigin;

  const host = resolveWebAuthnHost(request);
  const proto = firstValue(request.headers.get('x-forwarded-proto'))
    ?? request.nextUrl.protocol.replace(':', '');

  return `${proto}://${host}`;
}
