import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
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
      flow: 'register',
      username: user.username,
      userId: user.id,
    });

    if (!challengeEntry) {
      return NextResponse.json({ success: false, error: 'Challenge expired or missing' }, { status: 400 });
    }

    const verification = await verifyRegistrationResponse({
      response: parsed.data.response,
      expectedChallenge: challengeEntry.challenge,
      expectedOrigin: getExpectedOrigins(),
      expectedRPID: getRpId(),
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ success: false, error: 'Registration verification failed' }, { status: 400 });
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    authenticatorDB.create({
      userId: user.id,
      credentialId: isoBase64URL.fromBuffer(credential.id),
      credentialPublicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter ?? 0,
      transports: parsed.data.response.response?.transports ?? [],
    });

    const token = await createSession(user.id, user.username);
    const response = NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        username: user.username,
        credentialDeviceType,
        credentialBackedUp,
      },
    });
    setSessionCookieOnResponse(response, token);

    return response;
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to verify registration' }, { status: 500 });
  }
}
