type WebAuthnFlow = 'register' | 'login';

type ChallengeEntry = {
  challenge: string;
  flow: WebAuthnFlow;
  username: string;
  userId: number;
  expiresAt: number;
};

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const challengeStore = new Map<string, ChallengeEntry>();

function makeKey(flow: WebAuthnFlow, username: string): string {
  return `${flow}:${username.toLowerCase().trim()}`;
}

export function getRpId(): string {
  return process.env.WEBAUTHN_RP_ID ?? '127.0.0.1';
}

export function getExpectedOrigins(): string[] {
  const configured = process.env.WEBAUTHN_ORIGIN;
  if (configured) {
    return [configured];
  }

  return [
    'http://127.0.0.1:3000',
    'http://localhost:3000',
  ];
}

export function storeChallenge(input: {
  flow: WebAuthnFlow;
  username: string;
  userId: number;
  challenge: string;
}): void {
  const key = makeKey(input.flow, input.username);
  challengeStore.set(key, {
    challenge: input.challenge,
    flow: input.flow,
    username: input.username,
    userId: input.userId,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  });
}

export function consumeChallenge(input: {
  flow: WebAuthnFlow;
  username: string;
  userId: number;
}): ChallengeEntry | null {
  const key = makeKey(input.flow, input.username);
  const entry = challengeStore.get(key);
  challengeStore.delete(key);

  if (!entry) {
    return null;
  }

  if (entry.userId !== input.userId || entry.expiresAt < Date.now()) {
    return null;
  }

  return entry;
}
