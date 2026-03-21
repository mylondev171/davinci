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

Post-merge shape:
```ts
project_members: [{ user_id, role, profiles: { full_name, avatar_url } | null }]
```

No schema change. No frontend change.

---

### 2. Task Editing from /tasks Page

**Component:** `TaskForm` (`src/components/tasks/task-form.tsx`)

Currently requires a `projectId` prop (used when creating tasks). For editing, `projectId` is available from the task itself (`task.project_id`). No change needed for edit mode.

**UI change:** Add a pencil icon button to each task row in the Actions column on:
- `/tasks` page (`src/app/(dashboard)/tasks/page.tsx`)
- Client tasks tab (`src/components/clients/tasks-tab.tsx`)

The button renders `<TaskForm projectId={task.project_id} task={task} onSuccess={fetchTasks} trigger={<PencilIcon />} />`.

---

### 3. Creating Tasks from /tasks Page

**Problem:** `TaskForm` requires a `projectId` prop. The `/tasks` page has no project context.

**Solution:** Make `projectId` optional in `TaskForm`. When absent, render a project `<Select>` at the top of the form. The selected project id is used for the POST. Fetch the project list via `/api/projects` (already cached in the tasks page state — pass it as a prop or re-fetch inside the form).

**Simpler approach:** Pass the projects list (already fetched on the tasks page) as an optional `projects` prop to `TaskForm`. When `projectId` is not set and `projects` is provided, show the picker. When both are absent, disable the Create button.

**New button:** "New Task" button in the page header of `/tasks`, next to the filter controls. Renders `<TaskForm projects={projects} onSuccess={fetchTasks} />`.

No new API endpoints needed — creation still goes to `POST /api/projects/{projectId}/tasks`.

---

### 4. Timer on Tasks Page

`TimerWidget` is already built. Add it to each task row in the Actions column of:
- `/tasks` page
- Client tasks tab

```tsx
<TimerWidget taskId={task.id} taskTitle={task.title} />
```

The widget is self-contained (uses `localStorage` for cross-card sync) and handles start/stop/save inline.

---

### 5. Task-Level Billable Flag

**Why task-level:** The `time_entries` table already has `billable BOOLEAN NOT NULL DEFAULT true`. When a user logs time, they can toggle billable. A task-level default makes this smarter — tasks marked non-billable (internal work, warranty fixes) pre-fill time entries as non-billable automatically.

**DB migration (`00026`):**
```sql
ALTER TABLE public.tasks
  ADD COLUMN billable BOOLEAN NOT NULL DEFAULT true;
```

No index needed (not a filter column).

**TypeScript types:** Add `billable: boolean` to `tasks` Row and `billable?: boolean` to tasks Update in `src/types/database.ts`.

**TaskForm:** Add a `Switch` or checkbox labeled "Billable" below the Assignee field.

**TimeEntryForm:** Already accepts `entry?.billable` for pre-fill. Add a `defaultBillable?: boolean` prop, used when `entry` is absent:
```ts
setBillable(entry?.billable ?? defaultBillable ?? true)
```

**Kanban card:** Pass `defaultBillable={task.billable}` to `<TimeEntryForm>` and `<TimerWidget>`. Timer widget already accepts `onSuccess`; add `defaultBillable` prop so it forwards to the save dialog.

**Tasks page:** Pass `defaultBillable={task.billable}` to `<TimeEntryForm>` and `<TimerWidget>` in each row.

---

## File Map

| File | Change |
|---|---|
| `supabase/migrations/00026_add_tasks_billable.sql` | Create — add `billable` column to tasks |
| `src/types/database.ts` | Add `billable` to tasks Row/Update |
| `src/app/api/projects/[projectId]/route.ts` | Fix project_members profiles join |
| `src/components/tasks/task-form.tsx` | Make `projectId` optional, add project picker, add billable toggle |
| `src/components/tasks/time-entry-form.tsx` | Add `defaultBillable?: boolean` prop |
| `src/components/tasks/timer-widget.tsx` | Add `defaultBillable?: boolean` prop, forward to TimeEntryForm |
| `src/app/(dashboard)/tasks/page.tsx` | Add edit button, "New Task" button, TimerWidget per row |
| `src/components/clients/tasks-tab.tsx` | Add edit button, "New Task" button, TimerWidget per row |
| `src/components/projects/kanban-card.tsx` | Pass `defaultBillable` to TimeEntryForm and TimerWidget |

---

## Data Flow

```
Task (billable: bool)
  └── TaskForm sets task.billable
  └── KanbanCard / tasks page row
        ├── TimerWidget(defaultBillable=task.billable)
        │     └── on stop → TimeEntryForm(defaultBillable=task.billable, prefillHours)
        └── TimeEntryForm(defaultBillable=task.billable)
              └── POST /api/time-entries { billable: <from form> }
```

---

## Error Handling

- If project list fails to load in `TaskForm`, show an error toast and disable submit
- Timer conflicts (another task already running) handled by existing `window.confirm` in `TimerWidget`
- All mutations show toast success/error via existing pattern

---

## Success Criteria

1. Clicking into any project detail page loads successfully (no "Project not found")
2. Every task row on `/tasks` has a pencil icon that opens `TaskForm` pre-filled
3. "New Task" button on `/tasks` opens `TaskForm` with a project picker; task is created in the chosen project
4. Every task row on `/tasks` has a timer start/stop button
5. `TaskForm` has a Billable toggle; the value pre-fills the time-entry dialog when logging time
6. Existing kanban card timer and log-time buttons pass `defaultBillable` correctly
