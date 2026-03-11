# PRP 11: WebAuthn Authentication

## Feature Overview
Use WebAuthn and passkeys for passwordless authentication. This feature secures access to the app and establishes the session required by protected routes and APIs.

## User Stories
- As a user, I want to register without creating a password.
- As a user, I want to log in using a passkey on my device.
- As a user, I want protected pages to stay inaccessible until I authenticate.

## User Flow
1. User enters a username during registration.
2. The client requests registration options from the API.
3. The browser invokes the authenticator using WebAuthn.
4. The client submits the attestation response for verification.
5. On success, the server creates a session cookie.
6. During login, the same pattern is used with login options and verification.
7. User can log out from the top-right control.

## Functional Requirements
- Authentication must be WebAuthn only.
- Session tokens are stored as HTTP-only cookies.
- `/` and `/calendar` must be protected by middleware.
- Registration and login must use the server/browser flow described in the project instructions.
- Authenticator counters must be normalized with `counter: authenticator.counter ?? 0`.

## API Requirements
- Registration options endpoint.
- Registration verification endpoint.
- Login options endpoint.
- Login verification endpoint.
- Session creation and session validation helpers in `lib/auth.ts`.

## UI Requirements
- Registration flow requires a username and platform or security-key authentication.
- Login flow allows the user to select a username and authenticate with the passkey.
- Logout control is accessible from the top-right area.

## Security Requirements
- Never fall back to password authentication.
- Validate all WebAuthn payloads on the server.
- Keep credential identifiers encoded correctly using the existing base64/base64url helpers.
- Return safe error responses without leaking sensitive internals.

## Edge Cases
- Unsupported browser or authenticator.
- User cancels biometric or security-key verification.
- Missing or undefined authenticator counters.
- Expired or invalid challenges.

## Acceptance Criteria
- Users can register and log in successfully with WebAuthn.
- Protected routes reject unauthenticated access.
- Sessions persist through the intended authenticated experience.
- Counter handling safely supports undefined authenticator values.

## Testing Requirements
- E2E tests using virtual authenticators.
- Tests for register, login, logout, and unauthorized route access.
- Tests covering undefined counter handling.