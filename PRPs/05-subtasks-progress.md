# PRP 05: Subtasks and Progress Tracking

## Feature Overview
Allow users to break a todo into smaller checklist items and monitor progress in real time. Subtasks help manage complex work without changing the parent todo lifecycle.

## User Stories
- As a user, I want to add smaller steps under a todo.
- As a user, I want to mark each subtask complete independently.
- As a user, I want to see overall progress without expanding every todo.

## User Flow
1. User expands a todo using the Subtasks control.
2. User enters a subtask title and adds it.
3. User repeats the process for more subtasks.
4. User toggles individual subtask completion states.
5. The UI updates the progress bar and X/Y indicator immediately.

## Functional Requirements
- Users can add unlimited subtasks to a todo.
- Each subtask supports complete, uncomplete, and delete actions.
- Subtasks preserve their position order.
- Progress must be shown as both:
  - percentage
  - completed count out of total
- Subtask completion must not automatically complete the parent todo.
- Parent deletion must cascade to all subtasks.
- Subtask titles should participate in search results.

## UI Requirements
- Each todo exposes an expandable subtask area.
- The progress bar is visible even when the subtasks are collapsed.
- The text indicator uses the format `X/Y subtasks`.
- Add and delete controls should be accessible from the expanded panel.

## API and Data Requirements
- Store subtasks as child rows linked to the parent todo.
- Preserve order using a position field.
- Ensure cascade delete behavior when the parent todo is removed.

## Edge Cases
- Empty subtask titles.
- Large numbers of subtasks on a single todo.
- Deleting a subtask should recalculate progress correctly.
- Reordering or insertion must not duplicate positions.

## Acceptance Criteria
- Users can create, update completion state, and delete subtasks.
- Progress updates immediately after each subtask change.
- Search can find matching subtask titles.
- Deleting a parent todo removes all of its subtasks.

## Testing Requirements
- E2E tests for adding and completing subtasks.
- Tests for progress percentage and text indicator updates.
- Tests for cascade delete behavior.