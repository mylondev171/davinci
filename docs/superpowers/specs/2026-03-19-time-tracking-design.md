# Time Tracking Design

**Date:** 2026-03-19
**Status:** Approved

## Overview

Add time tracking to tasks: assign tasks to org members, log time manually or via live timer, mark entries as billable/non-billable, and view/export cumulative timesheets per client.

---

## Database

### New: `time_entries` table

```sql
CREATE TABLE time_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  date        DATE NOT NULL,
  hours       DECIMAL(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  note        TEXT,
  billable    BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_time_entries_org_id ON time_entries(org_id);
CREATE INDEX idx_time_entries_task_id ON time_entries(task_id);
CREATE INDEX idx_time_entries_project_id ON time_entries(project_id);
CREATE INDEX idx_time_entries_user_id ON time_entries(user_id);
```

**Design decisions:**
- `project_id` denormalized (mirrors `tasks.project_id`) for efficient timesheet queries
- `project_id` is **server-derived** from `task_id` on POST — client never sends it; API looks up the task's project to populate it, preventing mismatches
- `ON DELETE RESTRICT` on task/user/project to preserve billing history
- `date` always client-supplied (user's local date); server never defaults it
- `hours` capped at 24 to catch data entry errors
- `updated_at` for audit trail

### RLS Policies for `time_entries`

- **SELECT**: org members read all entries where `org_id` matches
- **INSERT**: org members only; `user_id` must equal authenticated user
- **UPDATE/DELETE**: admins and owners can modify any entry; members can only modify entries where `user_id = auth.uid()`
- Note: no billing-period lock in this iteration; locking historical entries is out of scope

### Existing `tasks` columns

- `assignee_id` — already in schema, not yet exposed in UI; no migration needed
- `actual_hours` — displayed as a UI-only sum of `time_entries.hours` for that task (no DB trigger); existing column values are ignored going forward

---

## Architecture

### APIs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/time-entries` | Create entry; `project_id` derived server-side from `task_id` |
| PATCH | `/api/time-entries/[id]` | Edit entry (hours, note, date, billable) |
| DELETE | `/api/time-entries/[id]` | Delete entry |
| GET | `/api/time-entries?client_id=&start=&end=&project_id=&user_id=&billable=` | Fetch entries; scoped by org; joins projects to filter by `client_id` |

**GET scoping:** `org_id` always applied. `client_id` scoped via `project_id → projects.client_id`. Date range on `time_entries.date`. All filters optional except `org_id`.

**Export fetch:** CSV and PDF exports trigger a **separate unbounded GET** with the same active filters (no pagination limit). This ensures the full date range is exported, not just the rendered page.

**New endpoint needed:**
- `GET /api/memberships` — does **not** exist as an API route; the team settings page queries Supabase directly. A new `GET /api/memberships` route must be created to return org members with profile names for the assignee dropdown.

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Assignee dropdown | `src/components/tasks/task-form.tsx` | Added to existing form |
| `TimeEntryForm` | `src/components/tasks/time-entry-form.tsx` | Modal for create and edit |
| `TimerWidget` | `src/components/tasks/timer-widget.tsx` | Start/stop timer; localStorage |
| `ClientTimesheetTab` | `src/components/clients/timesheet-tab.tsx` | Table + filters + totals + export |

---

## Feature Details

### 1. Task Assignee

- `Assignee` `<Select>` added to task create/edit form
- Populated from org memberships (profiles with names)
- Saves to `tasks.assignee_id`

### 2. Time Logging — Manual Entry

- "Log Time" button on:
  - **Kanban card** (`kanban-card.tsx`) — icon button in card footer
  - **Tasks list page** (`/tasks`) — action column
- `TimeEntryForm` dialog:
  - **Date** — date picker, defaults to today (client local date)
  - **Hours** — decimal input
  - **Note** — optional
  - **Billable** — toggle, default on
- Submits `POST /api/time-entries` with `task_id`, `user_id`, `org_id`, `date`, `hours`, `note`, `billable` — server resolves `project_id`

### 3. Time Logging — Live Timer

- `TimerWidget` appears per task alongside "Log Time" button
- **State:** `localStorage` key `active_timer` stores `{ taskId, startedAt: ISO string }`

**Start behavior:**
- If no active timer: starts immediately, writes to `localStorage`
- If another task's timer is active: shows confirm dialog — "Stop timing [Task A] (time not saved) and start [Task B]?" — on confirm, clears previous and starts new

**Stale timer recovery on mount:**
- If `active_timer` exists but `startedAt` is older than 12 hours: silently discard and clear
- If within 12 hours and task still accessible: resume with warning toast "Resuming timer from [X hours] ago — was your browser closed?"
- If task no longer exists or is inaccessible: silently clear

**Cross-tab sync:**
- Listens to the `storage` DOM event (fires cross-tab on every `localStorage` write)
- If another tab starts or stops a timer: this tab updates its UI in real time without requiring a focus event

**Stop behavior:**
- `elapsed_ms = Date.now() - new Date(startedAt).getTime()`
- `hours = Math.max(0.01, Math.ceil(elapsed_ms / 36000) / 100)` — rounds up to nearest 0.01h; enforces minimum of 0.01h to prevent zero-hour entries
- Pre-fills `TimeEntryForm` with computed hours and today's date; user can adjust before saving
- If timer ran less than ~6 seconds (would round to 0.00 before ceiling): still results in 0.01h minimum

**Elapsed display:** MM:SS updating every second via `setInterval`; cleared on unmount

### 4. Client Timesheet Tab

Location: new "Timesheets" tab on `/clients/[clientId]`.

**Table columns:** Date | Project | Task | Team Member | Hours | Billable | Note | Actions (edit, delete)

**Filters** (all totals and table respect active filters):
- Date range — start/end pickers; default = current calendar month
- Project — dropdown of this client's projects
- Team member — dropdown of org members
- Billable: All / Billable only / Non-billable only

**Summary row** (respects active filters):
Total Hours | Billable Hours | Non-billable Hours

**States:**
- Loading skeleton
- Empty state: "No time logged for this client yet"
- Error state with retry

**Fetch strategy:** Default load = current month. Changing the date range re-fetches. No offset pagination — the date range is the page boundary.

**Export:**
- Both CSV and PDF trigger a separate full fetch using the same active filters (not limited to rendered rows)
- **CSV:** columns match table + summary row at bottom; filename `[ClientName]-timesheet-[start]-[end].csv`
- **PDF:** `jspdf` + `jspdf-autotable`; header with client name and date range; table body; summary totals footer; filename `[ClientName]-timesheet-[start]-[end].pdf`
  - If the filtered result exceeds 1,000 rows: block PDF and show error "Too many rows for PDF — use CSV export or narrow the date range." CSV has no row cap.

---

## Dependencies

- `jspdf`
- `jspdf-autotable`

---

## Explicitly Out of Scope (This Iteration)

- Hourly rates / cost calculation — billable flag only, no dollar amounts
- Invoice generation
- Billing-period locks (preventing edits to historical entries)
- Time entry approval workflows
- Cross-client aggregate reports
- The `/reports` page — reserved for SEMRush/ReportGarden data only
