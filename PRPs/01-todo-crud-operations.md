# PRP 01: Todo CRUD Operations

## Feature Overview
Implement the core todo lifecycle for authenticated users. This feature covers creating, reading, updating, completing, and deleting todos, and it acts as the foundation for priority, recurring behavior, reminders, subtasks, tags, templates, export/import, and calendar views.

## User Stories
- As a user, I want to create a todo quickly from the main form.
- As a user, I want to edit an existing todo when details change.
- As a user, I want to complete a todo when it is done.
- As a user, I want to delete a todo I no longer need.
- As a user, I want all my todos to be private to my account.

## User Flow
1. User signs in with WebAuthn.
2. User enters a todo title in the main input field.
3. User optionally selects priority and due date/time.
4. User clicks Add.
5. The client posts the todo to the API.
6. The API validates the request and stores it for `session.userId`.
7. The UI refreshes the todo list and keeps the sort order stable.
8. The user can later edit, complete, or delete the todo.

## Functional Requirements
- Title is required and cannot be empty or whitespace only.
- Due date is optional.
- If a due date is provided, the minimum valid due date is 1 minute in the future.
- Todos are automatically sorted by priority and due date.
- Completing a non-recurring todo updates its completion state without creating another todo.
- Deleting a todo removes it from the list immediately after a successful response.

## UI Requirements
- The create form is located at the top of the main page.
- The form includes:
  - title input
  - priority dropdown
  - date-time picker
  - add button
- Overdue todos appear in a dedicated Overdue section.
- Completed todos appear separately from pending work.
- Todo actions must include edit, complete, and delete.

## API and Data Requirements
- All routes must validate the current session first.
- All queries must be scoped to `session.userId`.
- Use prepared statements in `lib/db.ts`.
- Database operations remain synchronous because the app uses `better-sqlite3`.
- Any date-sensitive behavior must use Singapore timezone utilities from `lib/timezone.ts`.

## Edge Cases
- Empty titles must be rejected with a user-friendly validation response.
- Invalid or past due dates must be rejected.
- Requests for missing or foreign todo IDs must return a safe error.
- Failed create, update, or delete operations must not leave the UI in a misleading state.

## Acceptance Criteria
- Users can create, edit, complete, and delete todos successfully.
- Todos are only visible to the authenticated user who owns them.
- Due dates are validated using Singapore timezone assumptions.
- Overdue todos are separated visually from other pending todos.
- Unauthorized requests return `401`.

## Testing Requirements
- E2E coverage for creating a todo with title only.
- E2E coverage for creating a todo with priority and due date.
- E2E coverage for editing title, priority, and due date.
- E2E coverage for completing and deleting a todo.
- API tests for validation and unauthorized access.

## Out of Scope
- Shared todos across users.
- Bulk editing.
- Offline sync.