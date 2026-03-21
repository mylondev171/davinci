# Task Editability, Timers, Billable & Projects Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add task editing, timers, and a billable flag to the `/tasks` list page and client tasks tab; allow creating tasks from the tasks page with a project picker; fix the project detail page "Project not found" bug caused by a broken Supabase join on `project_members`.

**Architecture:** Nine sequential tasks — DB migration first (billable column + TS types), then API fixes (project_members join, project tasks profiles join), then shared component updates (TimeEntryForm, TimerWidget, TaskForm), then UI wiring (kanban card, tasks page, client tasks tab). Type-check after every task before committing.

**Tech Stack:** Next.js 15 App Router, Supabase, TypeScript, Tailwind CSS, shadcn/ui, Sonner toasts

**Spec:** `docs/superpowers/specs/2026-03-21-task-editability-timers-billable-projects-fix.md`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/00026_add_tasks_billable.sql` | Create | Add `billable` column to tasks table |
| `src/types/database.ts` | Modify (lines 197–245) | Add `billable` to tasks Row and Update types |
| `src/app/api/projects/[projectId]/route.ts` | Modify | Fix project_members profiles join; merge all profiles in one query |
| `src/app/api/projects/[projectId]/tasks/route.ts` | Modify | Fix profiles join in GET and POST |
| `src/components/tasks/time-entry-form.tsx` | Modify | Add `defaultBillable?: boolean` prop |
| `src/components/tasks/timer-widget.tsx` | Modify | Add `defaultBillable?: boolean` prop; forward to TimeEntryForm |
| `src/components/tasks/task-form.tsx` | Modify | Make `projectId` optional; add `projects?` + `billable` to props; add project picker and billable toggle |
| `src/components/projects/kanban-card.tsx` | Modify | Pass `defaultBillable={task.billable}` to TimeEntryForm and TimerWidget |
| `src/app/(dashboard)/tasks/page.tsx` | Modify | Add edit button, "New Task" button, TimerWidget per row; pass defaultBillable |
| `src/components/clients/tasks-tab.tsx` | Modify | Add edit button, "New Task" button, TimerWidget per row; fetch client projects |

---

## Task 1: DB Migration — add `billable` to tasks

**Files:**
- Create: `supabase/migrations/00026_add_tasks_billable.sql`

- [ ] **Step 1: Write migration file**

```sql
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS billable BOOLEAN NOT NULL DEFAULT true;
```

- [ ] **Step 2: Apply via Supabase MCP**

Use `mcp__claude_ai_Supabase__apply_migration` with:
- `project_id`: `abjzbusopxgjbsvbgkvp`
- `name`: `00026_add_tasks_billable`
- `query`: the SQL above

Expected: `{"success": true}`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00026_add_tasks_billable.sql
git commit -m "feat: add billable column to tasks table"
```

---

## Task 2: TypeScript Types — add `billable` to tasks

**Files:**
- Modify: `src/types/database.ts`

The tasks `Row` is at lines 197–216, `Update` at lines 231–245.

- [ ] **Step 1: Add `billable` to tasks Row**

In the `Row` block (after `archived_at: string | null`), add:
```typescript
billable: boolean
```

Full Row block after change (lines 197–216):
```typescript
tasks: {
  Row: {
    id: string
    org_id: string
    project_id: string
    parent_task_id: string | null
    title: string
    description: string | null
    status: 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked'
    priority: 'low' | 'medium' | 'high' | 'urgent'
    assignee_id: string | null
    due_date: string | null
    estimated_hours: number | null
    actual_hours: number | null
    position: number
    tags: string[]
    completed_at: string | null
    archived_at: string | null
    billable: boolean
    created_at: string
    updated_at: string
  }
```

- [ ] **Step 2: Add `billable` to tasks Update**

In the `Update` block (after `archived_at?: string | null`), add:
```typescript
billable?: boolean
```

- [ ] **Step 3: Type-check**

```bash
cd "C:\Users\mylon\OneDrive\Desktop\Projects\AI Sites\geminicrmpms" && npx tsc --noEmit 2>&1 | head -30
```

Expected: no output (clean)

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add billable to tasks TypeScript types"
```

---

## Task 3: Fix Project Detail API — project_members profiles join

**Files:**
- Modify: `src/app/api/projects/[projectId]/route.ts`

**Problem:** The current query has `project_members(user_id, role, profiles:user_id(full_name, avatar_url))`. Supabase cannot follow `project_members.user_id → auth.users.id → profiles.id` (indirect FK), causing the query to error and the page to render "Project not found."

**Fix:** Strip profiles from the `project_members` select. Collect ALL user IDs (both task assignees and project members) and fetch profiles in a single query, then merge into both arrays.

- [ ] **Step 1: Update the Supabase select — strip profiles from project_members**

Change line 21:
```typescript
// FROM:
project_members(user_id, role, profiles:user_id(full_name, avatar_url))
// TO:
project_members(user_id, role)
```

- [ ] **Step 2: Replace the profiles fetch + return block**

Replace the entire block from `// Fetch assignee profiles separately` to `return NextResponse.json(...)` with:

```typescript
if (error) return NextResponse.json({ error: error.message }, { status: 404 })

// Collect all user IDs: task assignees + project members
const allUserIds = [...new Set([
  ...(data.tasks ?? [])
    .map((t: { assignee_id: string | null }) => t.assignee_id)
    .filter(Boolean),
  ...(data.project_members ?? [])
    .map((m: { user_id: string }) => m.user_id)
    .filter(Boolean),
])] as string[]

let profilesMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {}
if (allUserIds.length > 0) {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', allUserIds)
  if (profiles) {
    profilesMap = Object.fromEntries(
      profiles.map((p: { id: string; full_name: string | null; avatar_url: string | null }) => [
        p.id,
        { full_name: p.full_name, avatar_url: p.avatar_url },
      ])
    )
  }
}

const tasksWithProfiles = (data.tasks ?? []).map(
  (task: { assignee_id: string | null; [key: string]: unknown }) => ({
    ...task,
    profiles: task.assignee_id ? profilesMap[task.assignee_id] ?? null : null,
  })
)

const membersWithProfiles = (data.project_members ?? []).map(
  (member: { user_id: string; [key: string]: unknown }) => ({
    ...member,
    profiles: profilesMap[member.user_id] ?? null,
  })
)

return NextResponse.json({ data: { ...data, tasks: tasksWithProfiles, project_members: membersWithProfiles } })
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no output

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/projects/[projectId]/route.ts"
git commit -m "fix: fetch project_members profiles separately to fix Project not found bug"
```

---

## Task 4: Fix Project Tasks Route — profiles join

**Files:**
- Modify: `src/app/api/projects/[projectId]/tasks/route.ts`

Both the `GET` and `POST` handlers use `profiles:assignee_id(full_name, avatar_url)` which fails for the same indirect FK reason. Fix both to fetch profiles separately.

- [ ] **Step 1: Fix GET handler**

Replace the current GET handler body:

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await authenticateRequest(request)
  if (isErrorResponse(auth)) return auth
  const { supabase } = auth

  const { projectId } = await params

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .is('archived_at', null)
    .order('position')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const assigneeIds = [...new Set(data?.map(t => t.assignee_id).filter(Boolean))] as string[]
  let profilesMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {}
  if (assigneeIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', assigneeIds)
    if (profiles) {
      profilesMap = Object.fromEntries(profiles.map(p => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]))
    }
  }

  const tasksWithProfiles = data?.map(task => ({
    ...task,
    profiles: task.assignee_id ? profilesMap[task.assignee_id] ?? null : null,
  }))

  return NextResponse.json({ data: tasksWithProfiles })
}
```

Note: also added `.is('archived_at', null)` to exclude archived tasks.

- [ ] **Step 2: Fix POST handler — strip profiles from select, fetch separately**

Replace the POST handler's insert + return block:

```typescript
  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...body, project_id: projectId, org_id: orgId })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch assignee profile if set
  let profiles = null
  if (data.assignee_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('id', data.assignee_id)
      .single()
    profiles = profile ? { full_name: profile.full_name, avatar_url: profile.avatar_url } : null
  }

  await supabase.from('activities').insert({
    org_id: orgId,
    project_id: projectId,
    client_id: project?.client_id || null,
    task_id: data.id,
    actor_id: user.id,
    activity_type: 'task_created',
    title: `Created task "${data.title}"`,
  })

  return NextResponse.json({ data: { ...data, profiles } }, { status: 201 })
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no output

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/projects/[projectId]/tasks/route.ts"
git commit -m "fix: fetch task assignee profiles separately in project tasks route"
```

---

## Task 5: TimeEntryForm — add `defaultBillable` prop

**Files:**
- Modify: `src/components/tasks/time-entry-form.tsx`

- [ ] **Step 1: Add `defaultBillable` to the Props interface**

In the `interface Props` block (line 15), add after `trigger?`:
```typescript
defaultBillable?: boolean
```

- [ ] **Step 2: Destructure `defaultBillable` in the function signature**

```typescript
export function TimeEntryForm({ taskId, taskTitle, entry, prefillHours, open: controlledOpen, onOpenChange, onSuccess, trigger, defaultBillable }: Props) {
```

- [ ] **Step 3: Use `defaultBillable` in the useEffect**

Change the `setBillable` line in the `useEffect` (line 44) from:
```typescript
setBillable(entry?.billable ?? true)
```
To:
```typescript
setBillable(entry?.billable ?? defaultBillable ?? true)
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no output

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/time-entry-form.tsx
git commit -m "feat: add defaultBillable prop to TimeEntryForm"
```

---

## Task 6: TimerWidget — add `defaultBillable` prop

**Files:**
- Modify: `src/components/tasks/timer-widget.tsx`

- [ ] **Step 1: Add `defaultBillable` to Props interface**

Change the `interface Props` (line 33):
```typescript
interface Props { taskId: string; taskTitle: string; onSuccess?: () => void; defaultBillable?: boolean }
```

- [ ] **Step 2: Destructure `defaultBillable` and store in a ref**

In the function body, after the existing state declarations, add:
```typescript
const defaultBillableRef = useRef(defaultBillable)
defaultBillableRef.current = defaultBillable
```

The destructure on the function signature:
```typescript
export function TimerWidget({ taskId, taskTitle, onSuccess, defaultBillable }: Props) {
```

- [ ] **Step 3: Forward `defaultBillable` to TimeEntryForm**

The `<TimeEntryForm>` rendered at the bottom of the component (lines 107–113) — add `defaultBillable` prop:

```tsx
<TimeEntryForm
  taskId={taskId} taskTitle={taskTitle}
  prefillHours={prefillHours}
  open={saveOpen} onOpenChange={setSaveOpen}
  onSuccess={onSuccess}
  defaultBillable={defaultBillableRef.current}
/>
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no output

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/timer-widget.tsx
git commit -m "feat: add defaultBillable prop to TimerWidget"
```

---

## Task 7: TaskForm — optional projectId, project picker, billable toggle

**Files:**
- Modify: `src/components/tasks/task-form.tsx`

This is the largest single-file change. Read the whole file before starting.

- [ ] **Step 1: Update the task prop interface — add `project_id` and `billable`**

Change the `task?` type in `interface TaskFormProps` (line 18):
```typescript
task?: {
  id: string
  project_id: string
  title: string
  description: string | null
  status: string
  priority: string
  due_date: string | null
  assignee_id: string | null
  billable: boolean
}
```

Note: `project_id` is added here so `task?.project_id` compiles in the `selectedProjectId` initializer (Step 3).

- [ ] **Step 2: Update TaskFormProps — make `projectId` optional, add `projects`**

```typescript
interface TaskFormProps {
  projectId?: string
  projects?: { id: string; name: string }[]
  task?: { ... }  // as above
  defaultStatus?: string
  onSuccess?: () => void
  trigger?: React.ReactNode
}
```

- [ ] **Step 3: Add `selectedProjectId` state and `billable` to formData**

Replace the existing `useState` for `formData`:
```typescript
const [selectedProjectId, setSelectedProjectId] = useState(
  projectId || task?.project_id || ''
)

const [formData, setFormData] = useState({
  title: task?.title || '',
  description: task?.description || '',
  status: task?.status || defaultStatus || 'todo',
  priority: task?.priority || 'medium',
  due_date: task?.due_date || '',
  assignee_id: task?.assignee_id || '',
  billable: task?.billable ?? true,
})
```

- [ ] **Step 4: Update the `useEffect` — reset `selectedProjectId` and `billable` when dialog opens**

Replace the existing `useEffect` block:
```typescript
useEffect(() => {
  if (open) {
    setSelectedProjectId(projectId || task?.project_id || '')
    setFormData({
      title: task?.title || '',
      description: task?.description || '',
      status: task?.status || defaultStatus || 'todo',
      priority: task?.priority || 'medium',
      due_date: task?.due_date || '',
      assignee_id: task?.assignee_id || '',
      billable: task?.billable ?? true,
    })
    if (members.length === 0) {
      apiFetch('/api/memberships').then(({ data }) => setMembers(data || [])).catch(() => {})
    }
  }
}, [open, task, defaultStatus, projectId, members.length, apiFetch])
```

- [ ] **Step 5: Update `handleSubmit` — use `selectedProjectId` for create**

In `handleSubmit`, change the create branch:
```typescript
const payload = {
  ...formData,
  due_date: formData.due_date || null,
  assignee_id: formData.assignee_id || null,
}
if (task) {
  await apiFetch('/api/tasks', { method: 'PUT', body: JSON.stringify({ id: task.id, ...payload }) })
  toast.success('Task updated')
} else {
  await apiFetch(`/api/projects/${selectedProjectId}/tasks`, { method: 'POST', body: JSON.stringify(payload) })
  toast.success('Task created')
}
setOpen(false)
setFormData({ title: '', description: '', status: defaultStatus || 'todo', priority: 'medium', due_date: '', assignee_id: '', billable: true })
setSelectedProjectId(projectId || '')
onSuccess?.()
```

- [ ] **Step 6: Update submit button guard — disable if no project selected**

Change the submit button `disabled` condition:
```typescript
disabled={loading || !formData.title.trim() || (!task && !selectedProjectId)}
```

- [ ] **Step 7: Add project picker to the form JSX**

Inside the `<form>` block, BEFORE the title field, add a conditional project picker:

```tsx
{/* Project picker — shown when creating a task without a pre-set projectId */}
{!task && !projectId && projects && projects.length > 0 && (
  <div className="space-y-2">
    <Label>Project *</Label>
    <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
      <SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger>
      <SelectContent>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)}
```

- [ ] **Step 8: Add billable toggle to the form JSX**

After the Assignee `<div>` and before the submit buttons, add:
```tsx
<div className="flex items-center gap-2">
  <input
    type="checkbox"
    id="task-billable"
    checked={formData.billable}
    onChange={(e) => set('billable', String(e.target.checked))}
    className="rounded"
  />
  <Label htmlFor="task-billable" className="cursor-pointer">Billable</Label>
</div>
```

Note: `set()` currently uses `(k, v) => ({ ...p, [k]: v })` — it stores strings. Change the billable field to store a boolean directly. Update the `set` helper or use `setFormData` directly:

```typescript
// Keep set() for string fields, use setFormData directly for boolean:
onChange={(e) => setFormData((p) => ({ ...p, billable: e.target.checked }))}
```

And update `formData` type accordingly — `billable: boolean` not `string`.

- [ ] **Step 9: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no output

- [ ] **Step 10: Commit**

```bash
git add src/components/tasks/task-form.tsx
git commit -m "feat: TaskForm — optional projectId with project picker, billable toggle"
```

---

## Task 8: Kanban Card — pass `defaultBillable`

**Files:**
- Modify: `src/components/projects/kanban-card.tsx`

**Important:** Read the file first. `KanbanCard` already has `TaskForm` (with Pencil trigger), `TimeEntryForm` (with "Log" trigger), and `TimerWidget` in the non-draggable footer. This task ONLY adds `defaultBillable={task.billable}` to the two existing component calls — do NOT add new components.

- [ ] **Step 1: Add `defaultBillable` to the existing TimeEntryForm call**

Find the `<TimeEntryForm>` in the footer (around line 88). Add `defaultBillable={task.billable}`:
```tsx
<TimeEntryForm
  taskId={task.id}
  taskTitle={task.title}
  trigger={<Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground">Log</Button>}
  defaultBillable={task.billable}
/>
```

- [ ] **Step 2: Add `defaultBillable` to the existing TimerWidget call**

Find `<TimerWidget>` (around line 93). Add `defaultBillable={task.billable}`:
```tsx
<TimerWidget taskId={task.id} taskTitle={task.title} defaultBillable={task.billable} />
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no output

- [ ] **Step 4: Commit**

```bash
git add src/components/projects/kanban-card.tsx
git commit -m "feat: pass defaultBillable to TimeEntryForm and TimerWidget in kanban card"
```

---

## Task 9: Tasks Page — edit button, New Task button, timer per row

**Files:**
- Modify: `src/app/(dashboard)/tasks/page.tsx`

- [ ] **Step 1: Add imports**

Add to the existing import list:
```typescript
import { TaskForm } from '@/components/tasks/task-form'
import { TimerWidget } from '@/components/tasks/timer-widget'
import { Pencil } from 'lucide-react'
```

(CheckSquare, Calendar, Archive, Trash2 already imported. `Pencil` needs adding.)

- [ ] **Step 2: Add "New Task" button to the page header**

In the `return` block, find the header `<div>` that contains the `<h1>Tasks</h1>`:

```tsx
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
    <p className="text-muted-foreground">All tasks across your projects</p>
  </div>
  <TaskForm projects={projects} onSuccess={fetchTasks} />
</div>
```

- [ ] **Step 3: Add edit button per row in the Actions cell**

Find the Actions `<TableCell>` in the `tableContent` variable. Add the edit button as the FIRST item in the `<div className="flex items-center gap-1">`:

```tsx
<TableCell>
  <div className="flex items-center gap-1">
    <TaskForm
      projectId={task.project_id}
      task={{ ...task }}
      onSuccess={fetchTasks}
      trigger={
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" title="Edit task">
          <Pencil className="h-3 w-3" />
        </Button>
      }
    />
    {/* existing Archive and Delete buttons follow */}
```

- [ ] **Step 4: Add TimerWidget per row — replace bare TimeEntryForm with TimerWidget + TimeEntryForm**

Currently the Time column has `<TimeEntryForm taskId={task.id} taskTitle={task.title} />`.

Update it to also include `TimerWidget` and pass `defaultBillable`:

```tsx
<TableCell>
  <div className="flex items-center gap-1">
    <TimerWidget taskId={task.id} taskTitle={task.title} defaultBillable={task.billable} />
    <TimeEntryForm taskId={task.id} taskTitle={task.title} defaultBillable={task.billable} />
  </div>
</TableCell>
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no output

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/tasks/page.tsx"
git commit -m "feat: tasks page — edit button, New Task, timer per row"
```

---

## Task 10: Client Tasks Tab — edit button, New Task button, timer per row

**Files:**
- Modify: `src/components/clients/tasks-tab.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { TaskForm } from '@/components/tasks/task-form'
import { TimerWidget } from '@/components/tasks/timer-widget'
import { Pencil } from 'lucide-react'
```

(Archive, Trash2, Calendar already imported.)

- [ ] **Step 2: Add `clientProjects` state and fetch**

Add after the existing state declarations:
```typescript
const [clientProjects, setClientProjects] = useState<{ id: string; name: string }[]>([])
```

Add a fetch inside `fetchTasks` OR in a separate `useEffect`:
```typescript
useEffect(() => {
  apiFetch(`/api/projects?client_id=${clientId}`)
    .then(({ data }) => setClientProjects(data || []))
    .catch(() => {})
}, [apiFetch, clientId])
```

- [ ] **Step 3: Add "New Task" button above the tab switcher**

In the return JSX, above the tab switcher `<div className="flex gap-2">`, add:
```tsx
<div className="flex justify-end mb-2">
  <TaskForm projects={clientProjects} onSuccess={fetchTasks} />
</div>
```

- [ ] **Step 4: Add edit button per row**

In the Actions `<TableCell>`, add edit as first button:
```tsx
<TableCell>
  <div className="flex items-center gap-1">
    <TaskForm
      projectId={task.project_id}
      task={{ ...task }}
      onSuccess={fetchTasks}
      trigger={
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" title="Edit task">
          <Pencil className="h-3 w-3" />
        </Button>
      }
    />
    {/* existing Archive and Delete buttons */}
```

- [ ] **Step 5: Replace Time column with TimerWidget + TimeEntryForm**

Update the Time `<TableCell>` (currently just `<TimeEntryForm ...>`):
```tsx
<TableCell>
  <div className="flex items-center gap-1">
    <TimerWidget taskId={task.id} taskTitle={task.title} defaultBillable={task.billable} />
    <TimeEntryForm taskId={task.id} taskTitle={task.title} defaultBillable={task.billable} />
  </div>
</TableCell>
```

- [ ] **Step 6: Type-check and build**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no output

- [ ] **Step 7: Commit**

```bash
git add src/components/clients/tasks-tab.tsx
git commit -m "feat: client tasks tab — edit button, New Task, timer per row"
```

---

## Final Verification

- [ ] **Start dev server and verify:**

```bash
npm run dev
```

Checklist:
1. Navigate to `/projects` → click any project → page loads (no "Project not found")
2. Navigate to `/tasks` → pencil icon appears per row → clicking opens prefilled edit dialog
3. Click "New Task" on `/tasks` → project picker shown → select project → create task → appears in list
4. Timer play button visible per task row → click starts timer → elapsed shows → stop opens save dialog
5. Edit a task → uncheck Billable → save → click timer → stop → save dialog has billable unchecked
6. On a project's kanban card → "Log" button → save dialog → billable checkbox reflects task's setting

