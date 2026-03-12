import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { z } from 'zod';
import { userDB, authenticatorDB } from '@/lib/db';
import { getRpId, storeChallenge } from '@/lib/webauthn';

const bodySchema = z.object({
  username: z.string().trim().min(1).max(100),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid username' }, { status: 400 });
    }

    const user = userDB.findByUsername(parsed.data.username);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const authenticators = authenticatorDB.listByUserId(user.id);
    if (authenticators.length === 0) {
      return NextResponse.json({ success: false, error: 'No passkey registered for this user' }, { status: 400 });
    }

    const options = await generateAuthenticationOptions({
      rpID: getRpId(),
      userVerification: 'preferred',
      allowCredentials: authenticators.map((authenticator) => ({
        id: isoBase64URL.toBuffer(authenticator.credential_id),
        type: 'public-key',
        transports: authenticator.transports ? JSON.parse(authenticator.transports) : undefined,
      })),
    });

    storeChallenge({
      flow: 'login',
      username: user.username,
      userId: user.id,
      challenge: options.challenge,
    });

    return NextResponse.json({ success: true, data: options });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to start login' }, { status: 500 });
  }
}
