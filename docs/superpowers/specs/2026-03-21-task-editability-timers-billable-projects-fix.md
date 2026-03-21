# Design: Task Editability, Timers, Billable Flag & Projects Fix

**Date:** 2026-03-21
**Status:** Approved

---

## Problem Statement

The tasks system lacks full editability from the `/tasks` list page: no edit button per row, no way to add tasks without navigating to a project's kanban board, no timer control, and no billable toggle per task. Additionally, the project detail page always shows "Project not found" due to a broken Supabase join on `project_members`.

---

## Goals

1. Fix the project detail page ("Project not found" bug)
2. Allow editing any task (assignee, due date, priority, description) from the `/tasks` page and client tasks tab
3. Allow creating new tasks from the `/tasks` page (with project picker)
4. Surface the `TimerWidget` on every task row in the `/tasks` table
5. Add a task-level `billable` boolean (default `true`) that pre-fills the time-entry form

---

## Non-Goals

- Task subtasks / dependencies
- Project member management UI
- Inline cell editing (click a cell to edit in place)
- Bulk task operations

---

## Architecture

### 1. Fix Project Detail Page

**Root cause:** `GET /api/projects/[projectId]/route.ts` includes `project_members(user_id, role, profiles:user_id(full_name, avatar_url))` in its Supabase select. Supabase cannot follow the indirect path `project_members.user_id → auth.users.id → profiles.id`, so the query errors, the API returns 404, and the page renders "Project not found."

**Fix:** Remove `profiles` from the `project_members` select. After the main query succeeds, collect unique `user_id` values from `project_members`, fetch `profiles` in a separate query, and merge them back — exactly the same pattern already used for task assignee profiles in this same file.

```
project_members(user_id, role)   // was: project_members(user_id, role, profiles:user_id(...))
```

**Post-merge API response shape** (what consumers receive):
```ts
project_members: Array<{
  user_id: string
  role: string
  profiles: { full_name: string | null; avatar_url: string | null } | null
}>
```

This is identical to the shape consumers already expect — the field name `profiles` is preserved. No frontend consumers need to change.

No schema change.

---

### 2. Task Editing from /tasks Page

**Component:** `TaskForm` (`src/components/tasks/task-form.tsx`)

For editing, `projectId` comes from `task.project_id`. No change to the edit path.

**UI change:** Add a pencil icon button to each task row's Actions cell on:
- `/tasks` page (`src/app/(dashboard)/tasks/page.tsx`)
- Client tasks tab (`src/components/clients/tasks-tab.tsx`)

```tsx
<TaskForm
  projectId={task.project_id}
  task={{ ...task }}
  onSuccess={fetchTasks}
  trigger={<Button variant="ghost" size="sm" className="h-6 w-6 p-0"><Pencil className="h-3 w-3" /></Button>}
/>
```

---

### 3. Creating Tasks from /tasks Page

**Problem:** `TaskForm` currently requires `projectId: string`. The `/tasks` page has no project context.

**Solution:** Make `projectId` optional (`projectId?: string`). Add an optional `projects` prop:

```ts
interface TaskFormProps {
  projectId?: string
  projects?: { id: string; name: string }[]
  task?: { ... }
  ...
}
```

Internal state tracks `selectedProjectId` (initialized from `projectId` prop). Behavior by mode:

- **Edit mode** (`task` is provided): `projectId` comes from `task.project_id`; no dropdown shown; `selectedProjectId` initialized to `task.project_id`.
- **Create with prop** (`projectId` provided, no `task`): `selectedProjectId` initialized to `projectId`; no dropdown shown; existing behavior preserved.
- **Create without prop** (`projectId` absent, `projects` provided): dropdown shown at top of form; `selectedProjectId` starts empty; submit **disabled** until a project is selected (guard: `!selectedProjectId || !formData.title.trim()`).

On submit, the create POST uses `selectedProjectId`:
```ts
await apiFetch(`/api/projects/${selectedProjectId}/tasks`, { method: 'POST', body: JSON.stringify(payload) })
```

**"New Task" button:** Added to the header of `/tasks` page:
```tsx
<TaskForm projects={projects} onSuccess={fetchTasks} />
```

The `projects` state is already fetched on the page — pass it through. No new API calls needed.

---

### 4. Timer on Tasks Page

`TimerWidget` is already built and self-contained. Add it to each task row's Actions cell on:
- `/tasks` page
- Client tasks tab

```tsx
<TimerWidget taskId={task.id} taskTitle={task.title} defaultBillable={task.billable} />
```

The widget uses `localStorage` for cross-card timer sync and handles start/stop/save inline.

---

### 5. Task-Level Billable Flag

**Why task-level:** The `time_entries` table already has `billable BOOLEAN NOT NULL DEFAULT true`. A task-level default makes this smarter — tasks marked non-billable (internal work, warranty fixes) pre-fill time entries as non-billable automatically.

**DB migration (`00026`):**
```sql
ALTER TABLE public.tasks
  ADD COLUMN billable BOOLEAN NOT NULL DEFAULT true;
```

No index needed (not a filter column). The `DEFAULT true` means existing rows and new inserts that omit `billable` get `true` automatically.

**TypeScript types** (`src/types/database.ts`):
- `tasks Row`: add `billable: boolean`
- `tasks Update`: add `billable?: boolean`
- `tasks Insert`: no change needed — `DEFAULT true` covers omission; if explicitly setting, the `Update` type can be reused or it will still type-check via the column's default

**TaskForm:** Extend the `task?` prop interface to include `billable?: boolean`. Add a `Switch` (or checkbox) labeled "Billable" below the Assignee field. Initialized from `task?.billable ?? true`. Included in the submit payload for both create and update.

**TimeEntryForm** (`src/components/tasks/time-entry-form.tsx`):

Add `defaultBillable?: boolean` prop. Use it when no `entry` is present:
```ts
setBillable(entry?.billable ?? defaultBillable ?? true)
```

This is the only change — it's additive and backward-compatible.

**TimerWidget** (`src/components/tasks/timer-widget.tsx`):

Add `defaultBillable?: boolean` prop. Store it in a ref. When the timer stops and opens `TimeEntryForm`, forward it:

```tsx
// In TimerWidget:
const defaultBillableRef = useRef(defaultBillable)
defaultBillableRef.current = defaultBillable  // keep in sync if prop changes

// In the rendered TimeEntryForm (already rendered by TimerWidget on stop):
<TimeEntryForm
  taskId={taskId}
  taskTitle={taskTitle}
  prefillHours={prefillHours}
  open={saveOpen}
  onOpenChange={setSaveOpen}
  onSuccess={onSuccess}
  defaultBillable={defaultBillableRef.current}  // forwarded here
/>
```

**Kanban card** (`src/components/projects/kanban-card.tsx`):

Pass `defaultBillable={task.billable}` to both `<TimeEntryForm>` and `<TimerWidget>`.

**Tasks page + client tasks tab:**

Pass `defaultBillable={task.billable}` to both `<TimeEntryForm>` and `<TimerWidget>` in each row.

---

## File Map

| File | Change |
|---|---|
| `supabase/migrations/00026_add_tasks_billable.sql` | Create — add `billable` column to tasks |
| `src/types/database.ts` | Add `billable: boolean` to tasks Row; `billable?: boolean` to tasks Update |
| `src/app/api/projects/[projectId]/route.ts` | Fix project_members profiles join — strip profiles from select, fetch separately, merge |
| `src/components/tasks/task-form.tsx` | Make `projectId` optional; add `projects?` prop + project picker; add billable toggle |
| `src/components/tasks/time-entry-form.tsx` | Add `defaultBillable?: boolean` prop |
| `src/components/tasks/timer-widget.tsx` | Add `defaultBillable?: boolean` prop; forward to internal TimeEntryForm |
| `src/app/(dashboard)/tasks/page.tsx` | Add edit button per row, "New Task" button in header, TimerWidget per row |
| `src/components/clients/tasks-tab.tsx` | Add edit button per row, "New Task" button, TimerWidget per row |
| `src/components/projects/kanban-card.tsx` | Pass `defaultBillable={task.billable}` to TimeEntryForm and TimerWidget |

---

## Data Flow

```
Task (billable: bool)
  └── TaskForm sets task.billable on create/edit
  └── KanbanCard / tasks page row
        ├── TimerWidget(defaultBillable=task.billable)
        │     └── on stop → TimeEntryForm(defaultBillable=task.billable, prefillHours=elapsed)
        └── TimeEntryForm(defaultBillable=task.billable)
              └── POST /api/time-entries { billable: <from form, user can override> }
```

---

## Error Handling

- If project list fails to load in `TaskForm` project picker, show an error toast and disable submit
- If user submits `TaskForm` without selecting a project: submit button is disabled (no API call made)
- Timer conflicts handled by existing `window.confirm` in `TimerWidget`
- All mutations use existing toast success/error pattern

---

## Success Criteria

1. Clicking into any project detail page loads the project and its kanban board (no "Project not found")
2. Every task row on `/tasks` has a pencil icon; clicking it opens `TaskForm` pre-filled with the task's current title, description, priority, due date, and assignee
3. "New Task" button on `/tasks` opens `TaskForm` with a project dropdown; selecting a project and submitting creates the task under that project
4. If "New Task" is clicked without selecting a project, the submit button remains disabled
5. Every task row on `/tasks` has a timer start/stop button; starting it shows a running elapsed time display
6. `TaskForm` displays a Billable toggle; saving a task with `billable=false` persists that value
7. Opening the time-log dialog for a task with `billable=false` pre-fills the billable checkbox as unchecked
8. Kanban card timer and log-time buttons correctly pre-fill billable from the task's setting
