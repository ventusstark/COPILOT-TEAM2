import {
  verifyAuthenticationResponse,
  type VerifyAuthenticationResponseOpts,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { NextRequest, NextResponse } from 'next/server';
import { authenticatorDB, challengeDB, userDB } from '@/lib/db';
import { createSession, setSessionCookieOnResponse } from '@/lib/auth';
import { resolveRpID, resolveExpectedOrigin } from '@/lib/webauthn';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      username?: string;
      response?: unknown;
    };

    const username = body.username?.trim();
    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    if (!body.response) {
      return NextResponse.json(
        { error: 'Assertion response is required' },
        { status: 400 }
      );
    }

    const assertionResponse = body.response as unknown;
    if (
      typeof assertionResponse !== 'object'
      || assertionResponse === null
      || !('id' in assertionResponse)
      || !('rawId' in assertionResponse)
      || !('response' in assertionResponse)
      || !('type' in assertionResponse)
    ) {
      return NextResponse.json(
        { error: 'Invalid assertion response format' },
        { status: 400 }
      );
    }

    const id = String(assertionResponse.id);
    const rawIdStr = String(assertionResponse.rawId);
    const clientDataJSON = String(
      (assertionResponse.response as Record<string, unknown>).clientDataJSON ?? ''
    );
    const authenticatorData = String(
      (assertionResponse.response as Record<string, unknown>).authenticatorData ?? ''
    );
    const signature = String(
      (assertionResponse.response as Record<string, unknown>).signature ?? ''
    );

    if (!clientDataJSON || !authenticatorData || !signature) {
      return NextResponse.json(
        { error: 'Missing required response fields' },
        { status: 400 }
      );
    }

    // Find and consume the challenge
    let challenge: string;
    try {
      const decoded = JSON.parse(atob(clientDataJSON)) as { challenge?: string };
      challenge = decoded.challenge ?? '';
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse clientDataJSON' },
        { status: 400 }
      );
    }

    const storedChallenge = challengeDB.consume(challenge);
    if (!storedChallenge) {
      return NextResponse.json(
        { error: 'Invalid or expired challenge' },
        { status: 400 }
      );
    }

    // Find user
    const user = userDB.findByUsername(username);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Find the authenticator - use the id field which is base64url encoded
    const authenticator = authenticatorDB.findByCredentialId(id);
    if (!authenticator) {
      return NextResponse.json(
        { error: 'Authenticator not found' },
        { status: 404 }
      );
    }

    if (authenticator.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Authenticator does not belong to this user' },
        { status: 403 }
      );
    }

    // Verify the authentication response
    let verification;
    const expectedOrigin = resolveExpectedOrigin(request);
    const expectedRPID = resolveRpID(request);
    console.log('[login-verify] expectedOrigin:', expectedOrigin, 'expectedRPID:', expectedRPID);
    console.log('[login-verify] challenge:', challenge);
    console.log('[login-verify] authenticator.counter:', authenticator.counter, 'public_key length:', authenticator.public_key?.length);
    try {
      const opts: any = {
        response: {
          id,
          rawId: rawIdStr,
          response: {
            clientDataJSON,
            authenticatorData,
            signature,
          },
          type: 'public-key',
          clientExtensionResults: {},
        },
        expectedChallenge: challenge,
        expectedRPID,
        expectedOrigin,
        credential: {
          id: authenticator.credential_id,
          publicKey: authenticator.public_key,
          counter: authenticator.counter ?? 0,
          transports: authenticator.transports ?? undefined,
        },
        requireUserVerification: false,
      };

      verification = await verifyAuthenticationResponse(opts);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[login-verify] verifyAuthenticationResponse threw:', msg);
      return NextResponse.json(
        { error: `Verification failed: ${msg}` },
        { status: 400 }
      );
    }

    if (!verification.verified) {
      return NextResponse.json(
        { error: 'Assertion verification failed' },
        { status: 400 }
      );
    }

    // Check counter for cloned authenticator detection
    // Platform authenticators (Windows Hello, Touch ID) don't increment counter (stays 0)
    // Only block if counter has actually regressed, indicating a replay attack
    const newCounter = verification.authenticationInfo?.newCounter ?? null;
    const oldCounter = authenticator.counter ?? 0;

    if (newCounter !== null && newCounter > 0 && newCounter <= oldCounter) {
      console.warn(`Counter not incremented for authenticator ${id}. Possible clone detected.`);
      return NextResponse.json(
        { error: 'Authentication failed: security check' },
        { status: 403 }
      );
    }

    // Update counter
    if (newCounter !== null) {
      authenticatorDB.updateCounter(id, newCounter);
    }

    // Create session
    const token = await createSession(user.id, user.username);
    const response = NextResponse.json({ success: true });
    setSessionCookieOnResponse(response, token);

    return response;
  } catch (error) {
    console.error('Login verify error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
