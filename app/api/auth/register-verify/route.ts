import {
  verifyRegistrationResponse,
  VerifyRegistrationResponseOpts,
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
        { error: 'Attestation response is required' },
        { status: 400 }
      );
    }

    const attestationResponse = body.response as unknown;
    if (
      typeof attestationResponse !== 'object'
      || attestationResponse === null
      || !('id' in attestationResponse)
      || !('rawId' in attestationResponse)
      || !('response' in attestationResponse)
      || !('type' in attestationResponse)
    ) {
      return NextResponse.json(
        { error: 'Invalid attestation response format' },
        { status: 400 }
      );
    }

    const id = String(attestationResponse.id);
    const rawIdStr = String(attestationResponse.rawId);
    const clientDataJSON = String(
      (attestationResponse.response as Record<string, unknown>).clientDataJSON ?? ''
    );
    const attestationObject = String(
      (attestationResponse.response as Record<string, unknown>).attestationObject ?? ''
    );
    const transports = (attestationResponse.response as Record<string, unknown>).transports;

    if (!clientDataJSON || !attestationObject) {
      return NextResponse.json(
        { error: 'Missing clientDataJSON or attestationObject' },
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

    // Check if user already exists
    const existingUser = userDB.findByUsername(username);
    if (existingUser) {
      return NextResponse.json(
        { error: 'Username already registered' },
        { status: 400 }
      );
    }

    // Verify the registration response
    let verification;
    try {
      const opts: any = {
        response: {
          id,
          rawId: rawIdStr,
          response: {
            clientDataJSON,
            attestationObject,
            transports: transports as string[] | undefined,
          },
          type: 'public-key',
          clientExtensionResults: {},
        },
        expectedChallenge: challenge,
        expectedRPID: resolveRpID(request),
        expectedOrigin: resolveExpectedOrigin(request),
        requireUserVerification: false,
      };

      verification = await verifyRegistrationResponse(opts);
    } catch (error) {
      console.error('Registration verification error:', error);
      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 400 }
      );
    }

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: 'Registration verification failed' },
        { status: 400 }
      );
    }

    // Create user
    const user = userDB.create(username);

    // Store authenticator
    const regInfo = verification.registrationInfo;
    if (!regInfo) {
      return NextResponse.json(
        { error: 'Registration info not available' },
        { status: 500 }
      );
    }

    try {
      // Store the credential ID using the browser's base64url 'id' field directly
      // so it matches exactly what the browser sends back during login
      authenticatorDB.create({
        userId: user.id,
        credentialId: id,
        publicKey: Buffer.from(regInfo.credential.publicKey),
        counter: regInfo.credential.counter ?? 0,
        transports: (transports as string[] | undefined) ?? undefined,
        aaguid: regInfo.aaguid ? isoBase64URL.fromBuffer(Buffer.from(regInfo.aaguid)) : undefined,
        backedUp: regInfo.credentialBackedUp,
        backupEligible: regInfo.credentialDeviceType === 'multiDevice',
        deviceName: `Device registered on ${new Date().toLocaleDateString()}`,
      });
    } catch (error) {
      console.error('Failed to store authenticator:', error);
      return NextResponse.json(
        { error: 'Failed to store credential' },
        { status: 500 }
      );
    }

    // Create session
    const token = await createSession(user.id, user.username);
    const response = NextResponse.json({ success: true });
    setSessionCookieOnResponse(response, token);

    return response;
  } catch (error) {
    console.error('Register verify error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}
