# PRP 07: Template System

## Feature Overview
Let users save commonly reused todo configurations as templates and create new todos from them quickly. Templates reduce repetitive setup for routine work.

## User Stories
- As a user, I want to save a common todo setup as a reusable template.
- As a user, I want to create a todo instantly from a saved template.
- As a user, I want template metadata such as priority, recurrence, and reminder settings preserved.

## User Flow
1. User fills the todo form.
2. User clicks Save as Template.
3. User enters template name and optional description/category.
4. The template is saved in the user's library.
5. User later selects the template from the dropdown or template manager.
6. A new todo is created immediately using the template settings.

## Functional Requirements
- Template name is required.
- Description and category are optional.
- Templates preserve:
  - title template
  - priority
  - recurrence enabled state
  - recurrence pattern
  - reminder timing
  - category
  - description
- Templates do not preserve:
  - specific due dates
  - tags
  - subtasks
- Deleting a template must not affect todos already created from it.

## UI Requirements
- Save as Template is available when a title is present in the todo form.
- The Use Template dropdown must list saved templates.
- The template manager modal must support browse, use, and delete actions.
- Template cards should display name, optional description, category, priority, recurrence, and reminder summary.

## API and Data Requirements
- Templates are stored per user.
- Template subtasks are not required by the user guide behavior for this feature set.
- Any future template expansion endpoint must remain user-scoped and consistent with the create-todo flow.

## Edge Cases
- Attempting to save without a template name.
- Deleting a template currently visible in the dropdown.
- Using a template when optional fields are missing.

## Acceptance Criteria
- Users can save, view, use, and delete templates.
- Using a template creates a new todo immediately.
- Priority, recurrence, and reminder settings are copied correctly.
- Existing todos remain unchanged when a template is deleted.

## Testing Requirements
- E2E tests for saving and using a template.
- Tests for template deletion.
- Tests verifying which fields are copied and which are intentionally not copied.