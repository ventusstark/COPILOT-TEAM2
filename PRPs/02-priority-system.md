# PRP 02: Priority System

## Feature Overview
Add a three-level priority model to todos so users can distinguish urgent work from routine tasks. Priority affects visual display, filtering, and default ordering throughout the app.

## User Stories
- As a user, I want to flag urgent work as high priority.
- As a user, I want medium priority to serve as the default for normal work.
- As a user, I want low priority tasks to remain visible without crowding urgent items.

## Priority Model
Supported priority values:
- high
- medium
- low

Priority display from the user guide:
- High: red styling for urgent work
- Medium: yellow styling as the default state
- Low: blue styling for less urgent work

## User Flow
1. User selects a priority when creating a todo.
2. The selected value is stored with the todo.
3. Todo badges render with distinct color coding.
4. Todos are sorted with higher-priority work first.
5. User can change priority later by editing the todo.
6. User can filter the list using the priority dropdown.

## Functional Requirements
- Medium priority is the default when the user does not select another value.
- Priority badges appear next to todo titles.
- Priority display must remain visible in overdue and completed views where applicable.
- Priority filter must combine correctly with search, tags, and date filters.

## UI Requirements
- Create and edit flows must expose a priority dropdown.
- Priority badges must be easy to distinguish visually.
- Badge styling must remain legible in dark mode.

## API and Data Requirements
- Store priority in the todo record.
- Shared types should come from `lib/db.ts`.
- Invalid enum values must be rejected by the API.
- Legacy or null values should degrade safely to the default display state where needed.

## Edge Cases
- Invalid priority values from malformed requests.
- Existing records without a priority value.
- Changes to priority must not affect unrelated fields.

## Acceptance Criteria
- Users can create and edit todos with high, medium, and low priority.
- Priority badges are visible in the UI.
- Sorting places higher-priority tasks ahead of lower-priority tasks.
- Priority filtering works with other filters.

## Testing Requirements
- E2E tests for creating todos with each priority level.
- E2E tests for editing priority.
- Tests for sorting order.
- Tests for priority filtering in combination with search and tags.