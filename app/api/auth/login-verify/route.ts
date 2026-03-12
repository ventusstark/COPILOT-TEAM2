import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { z } from 'zod';
import { createSession, setSessionCookieOnResponse } from '@/lib/auth';
import { userDB, authenticatorDB } from '@/lib/db';
import { consumeChallenge, getExpectedOrigins, getRpId } from '@/lib/webauthn';

const bodySchema = z.object({
  username: z.string().trim().min(1).max(100),
  response: z.any(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }

    const user = userDB.findByUsername(parsed.data.username);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const challengeEntry = consumeChallenge({
      flow: 'login',
      username: user.username,
      userId: user.id,
    });

    if (!challengeEntry) {
      return NextResponse.json({ success: false, error: 'Challenge expired or missing' }, { status: 400 });
    }

    const credentialId = parsed.data.response?.id;
    if (!credentialId || typeof credentialId !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid credential' }, { status: 400 });
    }

    const authenticator = authenticatorDB.findByCredentialId(credentialId);
    if (!authenticator || authenticator.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Authenticator not found' }, { status: 404 });
    }

    const verification = await verifyAuthenticationResponse({
      response: parsed.data.response,
      expectedChallenge: challengeEntry.challenge,
      expectedOrigin: getExpectedOrigins(),
      expectedRPID: getRpId(),
      credential: {
        id: authenticator.credential_id,
        publicKey: isoBase64URL.toBuffer(authenticator.credential_public_key),
        counter: authenticator.counter ?? 0,
        transports: authenticator.transports ? JSON.parse(authenticator.transports) : [],
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      return NextResponse.json({ success: false, error: 'Login verification failed' }, { status: 400 });
    }

    const newCounter = verification.authenticationInfo.newCounter ?? authenticator.counter ?? 0;
    authenticatorDB.updateCounter(authenticator.id, newCounter);

    const token = await createSession(user.id, user.username);
    const response = NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        username: user.username,
      },
    });
    setSessionCookieOnResponse(response, token);

    return response;
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to verify login' }, { status: 500 });
  }
}
