# PRP 09: Export and Import

## Feature Overview
Enable users to back up, transfer, and analyze their todo data using JSON and CSV exports, plus JSON import for restoration. Import should create new records safely for the current user.

## User Stories
- As a user, I want a complete JSON backup of my todo data.
- As a user, I want a CSV export for spreadsheet analysis.
- As a user, I want to import a previous JSON export into my account.

## Supported Formats
Export:
- JSON
- CSV

Import:
- JSON only

## User Flow
1. User clicks Export JSON or Export CSV.
2. The file downloads with a date-based filename.
3. User can later choose Import and select a JSON export.
4. The app validates the file and creates new todos for the current user.
5. The list refreshes and shows a success or error message.

## Functional Requirements
- JSON export must include complete todo fields required for backup.
- CSV export must be spreadsheet-friendly and non-importable.
- Import creates new todos and does not merge into existing records.
- Imported records receive new IDs.
- Import must validate JSON syntax and data shape before writing.

## Data Preservation Rules
Preserved on import:
- title
- completion status
- due date
- priority
- recurrence settings
- reminder timings
- creation timestamps

Not preserved on import according to the user guide:
- original IDs
- original user ownership
- tags
- subtasks if they are not present in the import format

## UI Requirements
- Export and import controls appear in the top-right action area.
- Success and failure states must be visible to the user.
- Import should refresh the list automatically on success.

## API Requirements
- Export endpoint: `/api/todos/export?format={json|csv}`
- Import endpoint: `/api/todos/import`
- Import requests must remain scoped to the authenticated user.

## Edge Cases
- Invalid JSON syntax.
- Valid JSON with the wrong structure.
- Unsupported enum values.
- Re-importing the same file creates duplicates.

## Acceptance Criteria
- Users can export JSON and CSV successfully.
- Users can import a valid JSON export successfully.
- Invalid files are rejected with clear error messaging.
- Imported records are attached to the current user with new IDs.

## Testing Requirements
- E2E tests for JSON export, CSV export, and JSON import.
- Tests for invalid import payloads.
- Tests verifying that import creates duplicates instead of merges.