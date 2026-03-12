import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { NextRequest, NextResponse } from 'next/server';
import { userDB, challengeDB, authenticatorDB } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { username?: string };
    const username = body.username?.trim();

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
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

    // Get user's authenticators
    const authenticators = authenticatorDB.listByUserId(user.id);
    if (authenticators.length === 0) {
      return NextResponse.json(
        { error: 'No authenticators registered' },
        { status: 400 }
      );
    }

    // Generate authentication options
    // allowCredentials id must be a Base64URLString (string), not Uint8Array
    const allowCredentials = authenticators.map(auth => {
      const credential: any = {
        id: auth.credential_id,
      };
      if (auth.transports && auth.transports.length > 0) {
        credential.transports = auth.transports;
      }
      return credential;
    });

    const rpID = process.env.WEBAUTHN_RP_ID ?? request.nextUrl.hostname;
    const options = await generateAuthenticationOptions({
      rpID,
      timeout: 60000,
      userVerification: 'preferred',
      allowCredentials,
    });

    // Store challenge
    const challenge = options.challenge;
    challengeDB.create({
      challenge,
      userId: user.id,
      operation: 'login',
      expiresIn: 10,
    });

    return NextResponse.json({ options });
  } catch (error) {
    console.error('Login options error:', error);
    return NextResponse.json(
      { error: 'Failed to generate login options' },
      { status: 500 }
    );
  }
}
