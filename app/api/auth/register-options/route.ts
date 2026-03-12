import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
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

    const username = parsed.data.username;
    const existing = userDB.findByUsername(username);
    const user = existing ?? userDB.create(username);
    const authenticators = authenticatorDB.listByUserId(user.id);

    const options = await generateRegistrationOptions({
      rpName: 'Todo App',
      rpID: getRpId(),
      userName: user.username,
      userID: new TextEncoder().encode(String(user.id)),
      attestationType: 'none',
      excludeCredentials: authenticators.map((authenticator) => ({
        id: authenticator.credential_id,
        type: 'public-key',
        transports: authenticator.transports ? JSON.parse(authenticator.transports) : undefined,
      })),
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
    });

    storeChallenge({
      flow: 'register',
      username: user.username,
      userId: user.id,
      challenge: options.challenge,
    });

    return NextResponse.json({ success: true, data: options });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to start registration' }, { status: 500 });
  }
}
