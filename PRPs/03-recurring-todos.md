# PRP 03: Recurring Todos

## Feature Overview
Allow users to create repeating todos for ongoing routines and scheduled obligations. Completing a recurring todo should automatically create the next occurrence using the same saved settings.

## User Stories
- As a user, I want daily routines to recreate themselves automatically.
- As a user, I want weekly and monthly obligations to carry forward without manual re-entry.
- As a user, I want recurring todos to preserve their priority, reminder, and tags.

## Supported Patterns
- daily
- weekly
- monthly
- yearly

## User Flow
1. User enables Repeat while creating or editing a todo.
2. User selects a recurrence pattern.
3. User provides a due date, which is required for recurring todos.
4. The todo displays a recurring badge in the list.
5. When the user completes the todo, the API marks the current instance complete.
6. The API creates the next instance with the correct next due date.

## Functional Requirements
- Recurring todos require a due date.
- The next occurrence is created only when the current todo is marked complete.
- The next occurrence inherits:
  - priority
  - reminder timing
  - recurrence pattern
  - tags
- Date calculations must use Singapore timezone logic.

## UI Requirements
- The create and edit flows must expose a repeat toggle and recurrence dropdown.
- Recurring todos must display a visible recurring badge with the pattern label.
- Recurring state must remain clear in both standard and dark mode views.

## API and Data Requirements
- Store recurrence state and recurrence pattern in the todo model.
- Reuse the existing recurring completion behavior described for `PUT /api/todos/[id]`.
- All generated todos must remain scoped to the same user.

## Edge Cases
- Monthly recurrences on the 29th, 30th, or 31st.
- Leap-year behavior for yearly recurrences.
- Duplicate completion requests that could create multiple future instances.
- Missing due date when repeat is enabled.

## Acceptance Criteria
- Users can create recurring todos with all supported patterns.
- Completing a recurring todo creates the next instance automatically.
- The next instance preserves priority, reminder, tags, and recurrence pattern.
- Invalid recurring todos without due dates are rejected.

## Testing Requirements
- E2E tests for daily, weekly, monthly, and yearly recurring todos.
- Tests for metadata inheritance after completion.
- Date calculation tests for month-end and leap-year transitions.