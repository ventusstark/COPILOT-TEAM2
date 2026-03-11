# PRP 04: Reminders and Notifications

## Feature Overview
Provide browser notifications before due dates so users can act on upcoming work. Reminder calculations must align with Singapore timezone and avoid duplicate sends.

## User Stories
- As a user, I want to be reminded before a task is due.
- As a user, I want to choose how far in advance I get notified.
- As a user, I want reminders to trigger only once for the same scheduled event.

## Supported Reminder Options
- 15 minutes before
- 30 minutes before
- 1 hour before
- 2 hours before
- 1 day before
- 2 days before
- 1 week before

## User Flow
1. User clicks Enable Notifications and grants browser permission.
2. User creates or edits a todo with a due date.
3. User selects a reminder value from the Reminder dropdown.
4. The todo shows a reminder badge in the list.
5. The backend reminder check determines when a notification should fire.
6. The browser displays the notification once the reminder window is reached.

## Functional Requirements
- Notifications require browser permission.
- Reminder selection is disabled unless the todo has a due date.
- The system checks for pending reminders every minute.
- Each reminder must only be sent once.
- Notifications should still work when the browser tab is in the background.

## UI Requirements
- The top-right notification control must expose the permission flow.
- Enabled state should be visually distinguishable from disabled state.
- Todos with reminders must display a badge using short labels such as `15m`, `1h`, or `1d`.

## API and Data Requirements
- Use the notification flow built around `app/api/notifications/check/route.ts`.
- Duplicate suppression must respect `last_notification_sent`.
- Reminder calculations must use Singapore timezone helpers.
- Null reminder values must be handled safely with coalescing patterns.

## Edge Cases
- User denies notification permission.
- Todo loses its due date after a reminder was previously selected.
- Reminder time has already passed at the moment of edit.
- Multiple polling cycles around the same deadline.

## Acceptance Criteria
- Users can enable notifications and select supported reminder timings.
- Reminder selection is unavailable when no due date exists.
- Notifications trigger at the correct time in Singapore timezone.
- Duplicate notifications are prevented.

## Testing Requirements
- E2E tests for notification permission and enabled state.
- Tests for each reminder offset.
- Tests that repeated polling does not resend the same notification.