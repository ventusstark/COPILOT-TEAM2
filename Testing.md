# Testing Requirements

## Minimum Test Coverage

- Target: 80% or higher overall test coverage.
- Coverage must include unit, integration, and E2E layers.

## Required Test Types (All Required)

1. Unit Tests
- Scope: Individual functions, utilities, and components.
- Goal: Validate business logic and edge cases in isolation.

2. Integration Tests
- Scope: API endpoints and database operations.
- Goal: Verify module interactions and data flow correctness.

3. E2E Tests
- Scope: Critical user flows using Playwright.
- Goal: Validate real user behavior from UI to backend.

## Test-Driven Development (Mandatory Workflow)

Follow this exact sequence:

1. RED
- Write the test first.
- Run the test and confirm it fails.

2. GREEN
- Write the minimal implementation required.
- Run the test and confirm it passes.

3. IMPROVE
- Refactor for readability and maintainability.
- Re-run tests to confirm behavior is unchanged.

4. COVERAGE CHECK
- Verify coverage remains at or above 80%.

## Troubleshooting Test Failures

When tests fail:

1. Use tdd-guide agent.
2. Check test isolation.
3. Verify mocks are correct.
4. Fix implementation, not tests (unless tests are wrong).

## Agent Support

- tdd-guide
  - Use proactively for new features and bug fixes.
  - Enforces test-first implementation.

- e2e-runner
  - Use for Playwright E2E test authoring and execution.
  - Focus on critical user journeys and stability.

## Definition of Done for Testing

A change is not complete unless:

- Unit tests are added/updated where applicable.
- Integration tests are added/updated where applicable.
- E2E tests are added/updated for affected critical flows.
- All relevant tests pass.
- Coverage is 80% or higher.
