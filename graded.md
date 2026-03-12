# Todo App — Graded Evaluation Report

**Evaluation Date:** March 12, 2026
**Branch Evaluated:** `feature/workshop-day1-changes`
**Evaluator:** GitHub Copilot (automated audit)

---

## Summary Scorecard

| Category | Score | Max | % |
|---|---|---|---|
| Feature Completeness | 69 | 110 | 63% |
| Testing Coverage | 10 | 30 | 33% |
| Deployment Readiness | 7 | 30 | 23% |
| Quality & Performance | 18 | 30 | 60% |
| **TOTAL** | **104** | **200** | **52%** |

### Rating: ❌ Incomplete (100–119 range)

> Core features partially work but several have significant functional gaps. Testing depth is low and deployment has not been demonstrated.

---

## Feature Completeness — 69 / 110

### Feature 01: Todo CRUD — 8 / 10

**Implemented:**
- All five API routes: `POST /api/todos`, `GET /api/todos`, `GET /api/todos/[id]`, `PUT /api/todos/[id]`, `DELETE /api/todos/[id]`
- Zod validation on all inputs; future-date enforcement using Singapore timezone
- Three-section UI: Overdue (red), Active, Completed (green)
- Inline edit form replaces the list item on edit
- Optimistic delete (`setTodos(prev => prev.filter(...))`)
- Toggle completion button

**Gaps:**
- No delete confirmation dialog — delete fires immediately with no prompt
- Create and toggle do a full `loadTodos()` reload rather than optimistic update
- Edit is inline in the list, not a separate modal as described in the checklist

---

### Feature 02: Priority System — 9 / 10

**Implemented:**
- DB field with `CHECK (priority IN ('high', 'medium', 'low'))` and default `'medium'`
- Type `Priority = 'high' | 'medium' | 'low'` in both `lib/db.ts` and `app/page.tsx`
- API-level Zod enum validation
- Colour-coded badges on todo cards (red / yellow / blue)
- Priority dropdown in create form and inline edit form
- Priority filter `<select>` in the filter toolbar
- DB-level ORDER BY priority (SQL CASE expression)

**Gaps:**
- Priority controls are hidden behind a "Show Create Options" toggle by default — not immediately visible
- No formal dark-mode contrast audit conducted

---

### Feature 03: Recurring Todos — 9 / 10

**Implemented:**
- DB: `recurrence_enabled INTEGER` and `recurrence_pattern TEXT CHECK (...)` with migration guards
- Type `RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'`
- Validation: recurring todos require a due date (API and UI)
- Repeat toggle + pattern dropdown in create and edit forms
- Next-instance creation on completion (`computeNextRecurringDueDate`) inside `PUT /api/todos/[id]`
- Date arithmetic handles daily / weekly / monthly / yearly including Singapore month-boundary edge cases
- Next instance inherits: priority, tags, reminder offset, recurrence pattern
- Text "Repeat daily / weekly…" label displayed on todo items
- Can disable recurring on any existing todo via inline edit

**Gaps:**
- Badge uses plain text label ("Repeat daily") rather than the 🔄 emoji badge specified in the checklist — trivial cosmetic difference

---

### Feature 04: Reminders & Notifications — 8 / 10

**Implemented:**
- DB: `reminder_minutes INTEGER` and `last_notification_sent TEXT`
- `lib/hooks/useNotifications.ts`: custom hook with permission request, enable/disable toggle, polling, and browser `Notification` dispatch
- `GET /api/notifications/check`: atomic claim via `claimPendingRemindersByUser` (prevents duplicates with `WHERE last_notification_sent IS NULL`)
- "Enable Notifications" button in page header with four states (enabled / paused / blocked / default)
- 7-option reminder dropdown; disabled when no due date is set
- Reminder label badge on todo cards

**Gaps:**
- Polling interval is **60 seconds**, not 30 seconds as specified in the checklist
- No notification count badge or indicator in the UI beyond the button state text

---

### Feature 05: Subtasks & Progress Tracking — 1 / 10

**Implemented:**
- DB `subtasks` table with CASCADE delete, `completed`, `position` columns
- `subtaskDB.listByTodoId` and `subtaskDB.create` in `lib/db.ts`
- Subtasks returned in `TodoWithDetails` via `mapTodoRelations`

**Gaps — critical:**
- **No subtask API routes exist** — `POST /api/todos/[id]/subtasks`, `PUT /api/subtasks/[id]`, and `DELETE /api/subtasks/[id]` are all absent
- `subtaskDB` is missing `update` (toggle completion) and `delete` operations
- **No subtask UI in `app/page.tsx`** — no expandable section, no add-subtask input, no subtask checkboxes, no delete button
- **No progress bar** and no progress calculation anywhere in the client
- The client-side `Subtask` interface in `page.tsx` omits the `completed` field entirely
- This feature exists only at the schema level; it cannot be used by any user

---

### Feature 06: Tag System — 7 / 10

**Implemented:**
- DB: `tags` and `todo_tags` tables with constraints
- `GET /api/tags`, `POST /api/tags`, `PUT /api/tags/[id]`, `DELETE /api/tags/[id]`
- Tag assignment via `PUT /api/todos/[id]` with `tag_ids` array
- "Manage Tags" modal: create (name + colour), inline edit, delete
- Colour-coded tag badges on todo cards
- Tag checkbox selection in create and edit forms
- Tag filter `<select>` in filter toolbar

**Gaps:**
- No dedicated `POST /api/todos/[id]/tags` or `DELETE /api/todos/[id]/tags` routes (assignment goes through the main todo PUT)
- Tag badges are non-interactive `<span>` elements — clicking a badge does NOT filter; only the dropdown filters
- No separate "active tag filter" indicator with an individual clear button

---

### Feature 07: Template System — 5 / 10

**Implemented:**
- DB `templates` table with all required fields
- `GET /api/templates`, `POST /api/templates`, `DELETE /api/templates/[id]`
- `POST /api/templates/[id]/use` — creates a todo from a template
- "Save as Template" button in create form; save-template modal with name/description/category
- Template list modal with "Use" and "Delete" buttons
- Template preview panel (shows category, priority, repeat, reminder labels)

**Gaps:**
- **No `PUT /api/templates/[id]`** — templates cannot be edited; there is no update endpoint or edit UI
- `/use` sets `dueDate: null` and `reminderMinutes: null` regardless of template settings — template reminder offset and due date offset logic not implemented
- Subtask JSON serialisation not implemented — subtasks are not stored in templates nor recreated on use
- No category filter in the template modal list
- Template edit button absent from the modal

---

### Feature 08: Search & Filtering — 7 / 10

**Implemented:**
- Real-time search input — case-insensitive, matches todo titles and subtask titles
- Priority filter dropdown
- Tag filter dropdown
- Advanced toggle revealing completion filter, due-date range inputs
- Combined AND logic in `filteredTodos` computed value
- "Clear All" button resets all filters
- Empty state messages for each section
- Filter preset system — save, apply, and delete named filter sets (stored in `localStorage`)

**Gaps:**
- No debounce on search input (state updates on every keystroke)
- Search does **not** match tag names — only title + subtask titles
- No persistent "active filters" summary/indicator row showing currently active filters

---

### Feature 09: Export & Import — 5 / 10

**Implemented:**
- `GET /api/todos/export` — supports JSON and CSV via `?format=` query param, correct `Content-Disposition` headers
- `POST /api/todos/import` — Zod validation, handles `bool` and `int` for completed/recurrence fields
- Export JSON and Export CSV buttons in header
- Import JSON button (hidden `<input type="file">`)
- Success message with imported count; error message for invalid JSON/schema

**Gaps:**
- Export payload contains **only top-level todo fields** — subtasks and tags are not exported
- Import creates bare todos only — no tags or subtasks are restored
- No ID remapping — import would create duplicate todos if run on existing data
- No tag conflict resolution (tags not in export/import at all)
- No `version` field in JSON export format
- Export/import cannot serve as a full backup/restore tool in current state

---

### Feature 10: Calendar View — 6 / 10

**Implemented:**
- `app/calendar/page.tsx` — full calendar page with month grid
- `GET /api/calendar?year=&month=` — returns todos for the month alongside holiday data
- Sunday-start month grid generation (`buildMonthGrid`)
- Previous / Next / Today navigation buttons
- Day headers (Sun–Sat)
- Today cell highlighted (teal border)
- Singapore public holidays shown as red labels within day cells
- Todos appear on their due date cells (priority-coloured left border)

**Gaps:**
- **No click-day modal** — clicking a day cell does nothing; the rubric requires a modal listing that day's todos
- **No URL state management** — current month is React state only; `?month=YYYY-MM` query parameter is not read or written
- No todo count badge on days with multiple todos — all are listed inline which may overflow
- No dedicated `GET /api/holidays` route — holiday data is bundled into the calendar API response
- Weekends have no distinct visual styling from weekdays

---

### Feature 11: Authentication — 4 / 10

**Implemented:**
- DB `users` table (`id`, `username`, `created_at`)
- `POST /api/auth/login` — finds or creates user by username, issues JWT session cookie (HTTP-only, 7-day expiry, `SameSite: lax`)
- `POST /api/auth/logout` — clears session cookie
- `lib/auth.ts` — `createSession`, `getSession`, `getSessionFromRequest`, cookie helpers
- `middleware.ts` — protects `/` and `/calendar/:path*`, redirects unauthenticated requests to `/login`
- `app/login/page.tsx` — simple username text field + "Sign In" button

**Gaps — significant:**
- **WebAuthn has been removed** — the rubric (Feature 11) is specifically for passkey / WebAuthn authentication
- `register-options`, `register-verify`, `login-options`, and `login-verify` routes have all been deleted
- No `authenticators` table; `@simplewebauthn/*` packages uninstalled
- **No credential verification** — the current login accepts any username without any password or biometric proof. Any person can log in as any existing user by typing their username
- No `GET /api/auth/me` endpoint
- This is now effectively a demo/dev-only auth mechanism, not a secure production auth system

---

## Testing Coverage — 10 / 30

### E2E Tests (Playwright) — 9 / 15

| Test File | Feature | Quality |
|---|---|---|
| `tests/02-todo-crud.spec.ts` | Todo CRUD, API auth guards | Good — covers create, edit, complete, delete, validation |
| `tests/04-reminders-notifications.spec.ts` | Reminders | Good — badge, API guards, duplicate prevention |
| `tests/06-tag-system.spec.ts` | Tags | Good — create, assign, filter, delete |
| `tests/07-template-system.spec.ts` | Templates | Partial — no edit template test |
| `tests/08-search-filtering.spec.ts` | Search & Filter | Good — multi-filter, presets |
| `tests/09-export-import.spec.ts` | Export / Import | Adequate — JSON + CSV export, import, invalid reject |
| `tests/10-calendar-view.spec.ts` | Calendar | Partial — loads and navigates but no click-day or URL state test |
| `tests/11-authentication-webauthn.spec.ts` | Auth | **Will FAIL** — checks for "Register" and "Login" passkey buttons that no longer exist on the login page |

**Missing test files:** Feature 01 (standalone), Feature 03 (recurring todos), Feature 05 (subtasks — feature not built)

### Unit Tests — 0 / 10

No unit test files exist anywhere in the repository. There are no tests for:
- Singapore timezone / date calculations
- Recurrence date arithmetic
- Reminder time calculation
- Progress percentage calculation
- Import ID remapping
- Tag colour validation
- JWT creation / verification

### Manual Testing Evidence — 1 / 5

No documented manual test runs. Basic interactive functionality is implied by the presence of UI code. Score reflects the tested-in-browser assumption only.

---

## Deployment Readiness — 7 / 30

### Successful Deployment — 3 / 15
- No deployment has been demonstrated (no Railway or Vercel URL, no deployment artifact)
- Production build should succeed based on TypeScript/lint passing, but has not been verified
- `package.json` `start` script does not use `${PORT:-3000}` format needed for Railway

### Environment Configuration — 1 / 5
- No `.env.example` file exists
- `JWT_SECRET` env var is referenced in `lib/auth.ts` with a dev fallback
- No RP_ID, RP_NAME, or RP_ORIGIN vars needed (WebAuthn removed)

### Production Testing — 0 / 5
- No evidence of production environment testing

### Documentation — 3 / 5
- `README.md` present
- `USER_GUIDE.md` — comprehensive 2000+ line feature guide present
- `RAILWAY_DEPLOYMENT.md` and `RAILWAY_SIMPLE_SETUP.md` present
- `PRPs/` directory with 11 detailed prompt files
- Missing: `.env.example`, verified production setup instructions

---

## Quality & Performance — 18 / 30

### Code Quality — 7 / 10
- TypeScript `strict: true` enabled ✓
- Zod validation at all API boundaries ✓
- Prepared statements for every DB query ✓
- Input sanitisation (`sanitizeTagColor`, `.trim()` on strings) ✓
- `next lint` script present ✓
- HTTP-only cookies with `SameSite` and `Secure` (production) ✓
- Missing: `.env.example`, subtask routes (feature gap affecting quality score), `GET /api/auth/me`
- Concern: `Subtask` interface in `app/page.tsx` is inconsistent with `lib/db.ts` (missing `completed` field)

### Performance — 6 / 10
- SQLite indexes on `user_id`, `due_date`, tag/subtask foreign keys ✓
- Prepared statements reused across requests ✓
- `mapTodoRelations` uses batch queries (no N+1) ✓
- No performance budget measurements (response time, bundle size, LCP) verified
- No lazy loading for large todo lists
- Client-side filtering via `useMemo` is suitable for reasonable dataset sizes

### Accessibility — 2 / 5
- `aria-label` attributes on filter selects ("Priority filter", "Tag filter") ✓
- No formal Lighthouse accessibility audit
- No documented keyboard navigation testing
- No ARIA live regions for dynamic updates
- Focus management after modals is unverified

### Security — 3 / 5
- SQL injection: prevented via prepared statements throughout ✓
- XSS: React escapes output by default ✓
- Cookies: HTTP-only, `Secure` in production, `SameSite: lax` ✓
- JWT secret: env-var based with production guard ✓
- **Major concern:** Authentication is username-only — no credential verification. Any user can impersonate any other user by knowing their username. This is a significant security regression from the WebAuthn implementation.
- Rate limiting: not implemented

---

## Key Findings

### Critical Issues
1. **Feature 05 (Subtasks & Progress)** is not functional — no API routes, no UI, incomplete `subtaskDB`. This is the most complete gap in the feature set.
2. **Authentication security** — removing WebAuthn without replacing it with any credential verification (password, passkey, token) means session security relies solely on knowing a username. This is not suitable for production.
3. **E2E test 11 will fail** — the authentication test file references UI elements that no longer exist on the login page.

### Moderate Issues
4. **Feature 07 (Templates)** — no edit capability, subtask and reminder data not applied on use.
5. **Feature 09 (Export/Import)** — subtasks and tags not included; the feature cannot serve as a backup/restore.
6. **Feature 10 (Calendar)** — no click-day detail modal and no URL state.
7. **No unit tests** — the testing score is dragged down entirely by the absence of any unit test layer.

### Minor Issues
8. **Polling interval** — 60s actual vs. 30s specified.
9. **Search** — doesn't match tag names.
10. **No `.env.example`** file for deployment onboarding.

---

## Recommended Priorities to Improve Score

### Priority 1 — Build Feature 05 (Subtasks) from scratch  
**Gain: ~+7 points**
- Add `subtaskDB.update` and `subtaskDB.delete`
- Create `POST /api/todos/[id]/subtasks`, `PUT /api/subtasks/[id]`, `DELETE /api/subtasks/[id]`
- Build expandable subtask UI in `page.tsx` with progress bar
- Fix `Subtask` interface in `page.tsx` to include `completed`

### Priority 2 — Close Template and Export gaps  
**Gain: ~+5 points**
- Add `PUT /api/templates/[id]` and edit template UI
- Apply reminder and due-date offset in `/api/templates/[id]/use`
- Add subtask JSON serialisation to templates
- Extend export/import to include tags and subtasks with ID remapping

### Priority 3 — Add unit tests  
**Gain: ~+7–9 points**
- Tests for timezone calculations, recurrence date math, reminder logic, import remapping, progress calculation
- Even 5–10 well-targeted unit tests raise the Testing score significantly

### Priority 4 — Fix or update authentication  
**Gain: improves Security and Feature 11 scores**
- Either restore WebAuthn (which was the rubric intent), or add a password/PIN mechanism so auth is genuinely secure
- Fix `tests/11-authentication-webauthn.spec.ts` to match the current login page

### Priority 5 — Calendar: click-day modal and URL state  
**Gain: ~+2 points**
- Add a modal when a day cell is clicked showing todos for that date
- Sync `?month=YYYY-MM` to/from URL via `useSearchParams`

### Priority 6 — Deployment artifacts  
**Gain: ~+5–7 points**
- Create `.env.example`
- Verify `npm run build && npm start` locally
- Create `railway.json` or `nixpacks.toml` and deploy to Railway

---

## Final Score

| Category | Score | Max |
|---|---|---|
| Feature Completeness | 69 | 110 |
| Testing Coverage | 10 | 30 |
| Deployment Readiness | 7 | 30 |
| Quality & Performance | 18 | 30 |
| **TOTAL** | **104** | **200** |

### **52% — ❌ Incomplete**

The foundation of the application is solid — database design, API patterns, middleware, and the core CRUD/priority/recurring/notifications features are well constructed. The primary drags on the score are the completely unbuilt Subtasks feature, the absence of any unit tests, the lack of a verified deployment, and the security regression introduced by removing passkey auth without a replacement credential mechanism.

---

*Report generated against branch `feature/workshop-day1-changes` as of March 12, 2026.*
