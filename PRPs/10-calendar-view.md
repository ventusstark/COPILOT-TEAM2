# PRP 10: Calendar View

## Feature Overview
Show todos on a monthly calendar so users can visualize upcoming deadlines, identify overloaded dates, and plan around public holidays.

## User Stories
- As a user, I want to see my due work laid out by date.
- As a user, I want to navigate between months easily.
- As a user, I want holiday context when planning tasks.

## User Flow
1. User clicks Calendar from the main navigation.
2. The app loads the calendar page at `/calendar`.
3. The current month is displayed by default.
4. User navigates to previous or next months, or jumps back to today.
5. Todos appear on their due dates using priority color coding.

## Functional Requirements
- Calendar page must be protected by authentication middleware.
- Todos appear on the correct date using Singapore timezone assumptions.
- Multiple todos can be displayed on the same day.
- Public holidays should render when holiday data is available.
- Calendar data stays synchronized with the main todo list state.

## UI Requirements
- Monthly grid layout with week rows.
- Current month and year displayed prominently.
- Previous, next, and today controls.
- Current day highlighted.
- Past dates visually distinguished from future dates.
- Priority color coding for todo entries:
  - high in red
  - medium in yellow
  - low in blue

## API and Data Requirements
- Calendar should use the same underlying todo data as the list view.
- Holiday data should come from the existing holidays source.
- Route protection must match the rest of the authenticated app.

## Edge Cases
- Todos without due dates should not render on a date cell.
- Multiple items on the same day should remain readable.
- Month transitions across year boundaries.
- Empty months with no todos.

## Acceptance Criteria
- Users can open and navigate the calendar view.
- Todos render on the correct local day.
- Holiday information appears when configured.
- Calendar updates stay aligned with the main todo dataset.

## Testing Requirements
- E2E tests for calendar navigation.
- Tests for due-date placement using Singapore timezone.
- Tests for holiday rendering where data exists.