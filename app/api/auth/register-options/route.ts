import { generateRegistrationOptions } from '@simplewebauthn/server';
import { NextRequest, NextResponse } from 'next/server';
import { challengeDB, userDB } from '@/lib/db';

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

    // Check if user already exists
    const existingUser = userDB.findByUsername(username);
    if (existingUser) {
      return NextResponse.json(
        { error: 'Username already registered' },
        { status: 400 }
      );
    }

    // Generate registration options
    const rpID = process.env.WEBAUTHN_RP_ID ?? request.nextUrl.hostname;
    const options = await generateRegistrationOptions({
      rpID,
      rpName: 'Todo App',
      userName: username,
      userDisplayName: username,
      timeout: 60000,
      attestationType: 'direct',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      supportedAlgorithmIDs: [-7, -257],
    });

    // Store challenge for verification
    const challenge = options.challenge;
    challengeDB.create({
      challenge,
      operation: 'registration',
      expiresIn: 10,
    });

    return NextResponse.json({ options });
  } catch (error) {
    console.error('Register options error:', error);
    return NextResponse.json(
      { error: 'Failed to generate registration options' },
      { status: 500 }
    );
  }
}
