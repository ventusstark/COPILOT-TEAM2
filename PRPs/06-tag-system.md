# PRP 06: Tag System

## Feature Overview
Add reusable, color-coded tags so users can categorize todos and filter them more effectively. Tags are user-specific and support many-to-many relationships with todos.

## User Stories
- As a user, I want to organize tasks using custom categories.
- As a user, I want to apply more than one tag to a todo.
- As a user, I want to filter my list to a single tag.

## User Flow
1. User opens the tag management modal.
2. User creates a tag with a name and color.
3. User selects tags while creating or editing a todo.
4. Tags appear as colored pills on the todo.
5. User filters the list by tag from the filter dropdown.

## Functional Requirements
- Tags are user-specific.
- Tag names must be unique per user.
- Users can create, edit, and delete tags.
- Users can assign multiple tags to a single todo.
- Deleting a tag removes its associations from affected todos.
- Tag filters must compose with search, priority, completion, and date filters.

## UI Requirements
- Tag management must support:
  - text input for name
  - color picker
  - hex input
  - edit and delete actions
- Selected tags must be visually distinct from unselected tags.
- Todo tags must render as colored pills in all major sections.
- Tag layout should wrap cleanly on mobile screens.

## API and Data Requirements
- Use a tags table plus a todo-tags join table.
- Tag CRUD and tag assignment must be scoped to `session.userId`.
- Preserve many-to-many relationships when reading and updating todos.

## Edge Cases
- Duplicate tag names for the same user.
- Invalid hex color input.
- Deleting a tag in use by many todos.
- Filtering when no tags exist.

## Acceptance Criteria
- Users can create, edit, delete, and assign tags.
- Multiple tags can be attached to one todo.
- Tag pills render with the configured colors.
- Tag filtering works and combines with other filters.

## Testing Requirements
- E2E tests for tag CRUD.
- E2E tests for multi-tag assignment.
- Tests for tag filter behavior.
- Tests that deleting a tag removes associations safely.