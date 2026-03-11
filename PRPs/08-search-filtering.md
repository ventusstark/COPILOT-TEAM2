# PRP 08: Search and Advanced Filtering

## Feature Overview
Provide a responsive search and filtering experience so users can isolate the exact subset of todos they need. The system supports text search, quick filters, advanced filters, and saved presets.

## User Stories
- As a user, I want to search across todo titles and subtasks.
- As a user, I want to combine multiple filters to narrow the list quickly.
- As a user, I want to save common filter combinations for repeat use.

## Search Scope
Search must match:
- todo titles
- subtask titles

Search behavior from the user guide:
- real-time updates while typing
- case-insensitive matching
- partial matches supported

## Filter Set
Quick filters:
- priority
- tag
- advanced panel toggle

Advanced filters:
- completion status
- due date from
- due date to
- saved filter presets

## User Flow
1. User types in the search bar.
2. Results update immediately.
3. User applies one or more quick filters.
4. User optionally expands the advanced panel.
5. User adds completion and date range constraints.
6. User can save the active combination as a preset.

## Functional Requirements
- All active filters use AND logic.
- Search must support clearing via text deletion or the clear button.
- Date range filters only apply to todos with due dates.
- The UI must expose Clear All when any filter is active.
- Users can save named filter presets to browser localStorage.
- Applying a preset overwrites the current filter state.

## UI Requirements
- Search bar appears below the todo form.
- Placeholder text should indicate search across todos and subtasks.
- Quick filters render in a horizontal row.
- Advanced panel is collapsible.
- Saved presets appear as clickable pills with delete actions.
- Empty-result states should be explicit.

## Data Requirements
- Presets are browser-local, not server-side.
- Presets persist across refreshes on the same device/browser.

## Edge Cases
- No matching results.
- Filters applied while no tags exist.
- One-sided date ranges.
- Preset names that collide or are blank.

## Acceptance Criteria
- Search finds matches in todo titles and subtask titles.
- Priority, tag, completion, and date filters compose correctly.
- Saved presets can be created, applied, and deleted.
- Todo counts update to reflect filtered results.

## Testing Requirements
- E2E tests for search behavior.
- Tests for combined filters using AND logic.
- Tests for preset save/apply/delete flows.