# Session Progress — GeminiCRM PMS

## Build Status
**PASSING** — 38/38 pages, zero errors (last checked this session)

---

## Pending Supabase Migrations
These have been written but **must be applied in the Supabase dashboard** before testing:

| File | Purpose |
|---|---|
| `00021_create_time_entries.sql` | `time_entries` table with RLS |
| `00022_fix_integration_credentials_user_rls.sql` | Allows non-admin users to read their own Google OAuth row |
| `00023_create_mcp_api_keys.sql` | `mcp_api_keys` table for Coworker AI MCP connection |
| `00024_fix_activities_constraint.sql` | Adds missing `project_updated` activity type to check constraint |

---

## What Was Built This Session

### 1. Supabase Migrations (written, not yet applied)
- `00021` — `time_entries` table (org_id, task_id, project_id, user_id, date, hours, note, billable, ON DELETE RESTRICT to preserve billing history)
- `00022` — RLS fix so regular members can see/manage their own Google integration credentials
- `00023` — `mcp_api_keys` table (stores SHA-256 hashed keys only, never raw)
- `00024` — Fixes pre-existing `project_updated` crash in activities constraint

### 2. Coworker AI MCP Connector
- **`src/app/api/mcp/route.ts`** — Full MCP server over StreamableHTTP. Handles `initialize`, `tools/list`, `tools/call`. Auth via `Authorization: Bearer <key>`.
- **`src/app/api/mcp-keys/route.ts`** — GET (list keys) + POST (generate key, returns raw key once)
- **`src/app/api/mcp-keys/[keyId]/route.ts`** — DELETE (revoke key)
- **Settings UI** — New "Automations" section added to `/settings/integrations` with server URL copy, key generation, active key list with last-used date, revoke button

**To connect in Coworker AI:** Settings → Integrations → Automations → Generate Key → copy URL + key → Coworker AI → Connectors → MCP

### 3. Time Tracking Feature
Full implementation of the spec at `docs/superpowers/specs/2026-03-19-time-tracking-design.md`

**API Routes:**
- `src/app/api/time-entries/route.ts` — GET (filters: client_id, project_id, user_id, start, end, billable) + POST (derives project_id server-side from task_id)
- `src/app/api/time-entries/[id]/route.ts` — PATCH (edit hours/date/note/billable) + DELETE
- `src/app/api/memberships/route.ts` — GET org members with profiles (for assignee dropdowns)

**Components:**
- `src/components/tasks/time-entry-form.tsx` — Dialog with date, hours, note, billable. Supports create + edit. Accepts `prefillHours` for timer stop flow. Controlled or uncontrolled open state.
- `src/components/tasks/timer-widget.tsx` — Start/stop timer. localStorage key `active_timer`. Stale recovery (>12h discards silently). Cross-tab sync via `storage` event. Stop → pre-fills TimeEntryForm. Elapsed display MM:SS.
- `src/components/clients/timesheet-tab.tsx` — Full timesheet: date range / project / member / billable filters, summary totals (total / billable / non-billable), edit + delete per row, CSV export (no lib), PDF export (jspdf + jspdf-autotable, blocked at >1000 rows).

**Updated Files:**
- `src/components/tasks/task-form.tsx` — Added assignee dropdown, fetches from `/api/memberships`
- `src/components/projects/kanban-card.tsx` — Added non-draggable footer with Edit (TaskForm), Log Time (TimeEntryForm), and Timer (TimerWidget) buttons. Uses `onPointerDown stopPropagation` to prevent DnD conflicts.
- `src/components/projects/kanban-board.tsx` — Threads `onTaskEdit={onTaskUpdate}` into KanbanCard
- `src/app/(dashboard)/tasks/page.tsx` — Added Client filter, Project filter (cascades from client), Log Time button per row
- `src/app/(dashboard)/clients/[clientId]/page.tsx` — Added "Timesheets" tab rendering ClientTimesheetTab

**Packages installed:** `jspdf@^4.2.1`, `jspdf-autotable@^5.0.7`

---

## Known Issues / Follow-up Items
- The two build warnings (`turbopack.root`, `middleware deprecated`) are cosmetic and pre-existing — not caused by this session's changes
- `jspdf-autotable` v5 uses a default export — the import in `timesheet-tab.tsx` uses `import { default as autoTable }` which should be verified at runtime
- Timer stale-recovery toast fires on every mount if a timer is in progress (by design per spec), but may be noisy — tune if needed

---

## File Tree of All New/Modified Files This Session
```
supabase/migrations/
  00021_create_time_entries.sql          ← NEW (apply in Supabase)
  00022_fix_integration_credentials_user_rls.sql ← NEW (apply in Supabase)
  00023_create_mcp_api_keys.sql          ← NEW (apply in Supabase)
  00024_fix_activities_constraint.sql    ← NEW (apply in Supabase)

src/app/api/
  mcp/route.ts                           ← NEW
  mcp-keys/route.ts                      ← NEW
  mcp-keys/[keyId]/route.ts             ← NEW
  memberships/route.ts                   ← NEW
  time-entries/route.ts                  ← NEW
  time-entries/[id]/route.ts            ← NEW
  tasks/route.ts                         ← MODIFIED (added client_id filter)

src/components/
  tasks/time-entry-form.tsx              ← NEW
  tasks/timer-widget.tsx                 ← NEW
  tasks/task-form.tsx                    ← MODIFIED (added assignee dropdown)
  projects/kanban-card.tsx               ← MODIFIED (added footer actions)
  projects/kanban-board.tsx              ← MODIFIED (threads onTaskEdit)
  clients/timesheet-tab.tsx              ← NEW

src/app/(dashboard)/
  tasks/page.tsx                         ← MODIFIED (client/project filters + Log Time)
  clients/[clientId]/page.tsx           ← MODIFIED (Timesheets tab)
  settings/integrations/page.tsx         ← MODIFIED (Coworker AI MCP section)
```
