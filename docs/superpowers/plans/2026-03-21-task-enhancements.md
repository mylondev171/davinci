# Task Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add status color coding, Active/Completed tabs, archive/delete, fix the project page profiles bug, and add a Tasks tab to the client detail page.

**Architecture:** Five independent changes applied in dependency order — DB migration first, then API fixes, then UI. A shared `TASK_STATUS_COLORS` map lives in `src/lib/task-colors.ts` and is consumed by both the tasks page and the new client tasks tab to keep color logic DRY.

**Tech Stack:** Next.js 15 App Router, Supabase, Tailwind CSS, shadcn/ui, TypeScript

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/00025_add_tasks_archived_at.sql` | Create | Adds `archived_at` column to tasks |
| `src/types/database.ts` | Modify | Add `archived_at` to tasks Row/Update types |
| `src/lib/task-colors.ts` | Create | Shared status dot color map |
| `src/app/api/tasks/route.ts` | Modify | Exclude archived from GET; add DELETE handler |
| `src/app/api/projects/[projectId]/route.ts` | Modify | Fix nested profiles join bug |
| `src/app/(dashboard)/tasks/page.tsx` | Modify | Active/Completed tabs, colored status select, archive/delete buttons |
| `src/components/projects/kanban-card.tsx` | Modify | Add archive/delete buttons to footer |
| `src/components/clients/tasks-tab.tsx` | Create | Tasks tab for client detail page |
| `src/app/(dashboard)/clients/[clientId]/page.tsx` | Modify | Add Tasks tab |

---

## Task 1: DB Migration — add `archived_at`

**Files:**
- Create: `supabase/migrations/00025_add_tasks_archived_at.sql`

- [ ] **Step 1: Write migration**

```sql
ALTER TABLE public.tasks
  ADD COLUMN archived_at TIMESTAMPTZ;

CREATE INDEX idx_tasks_archived_at ON public.tasks(archived_at)
  WHERE archived_at IS NULL;
```

- [ ] **Step 2: Apply via Supabase MCP**

Use `mcp__claude_ai_Supabase__apply_migration` with:
- `project_id`: `abjzbusopxgjbsvbgkvp`
- `name`: `00025_add_tasks_archived_at`
- `query`: the SQL above

Expected: `{"success": true}`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00025_add_tasks_archived_at.sql
git commit -m "feat: add archived_at column to tasks"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `src/types/database.ts` — tasks Row and Update types

- [ ] **Step 1: Add `archived_at` to tasks `Row`**

In the `Row` block for tasks (around line 197), add after `completed_at`:
```typescript
archived_at: string | null
```

- [ ] **Step 2: Add `archived_at` to tasks `Update`**

In the `Update` block for tasks (around line 230), add:
```typescript
archived_at?: string | null
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no output (clean)

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add archived_at to tasks TypeScript types"
```

---

## Task 3: Shared Status Color Helper

**Files:**
- Create: `src/lib/task-colors.ts`

- [ ] **Step 1: Create the file**

```typescript
export const TASK_STATUS_COLORS: Record<string, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  in_review: 'bg-purple-500',
  done: 'bg-green-500',
  blocked: 'bg-red-500',
}

export function statusDot(status: string) {
  return TASK_STATUS_COLORS[status] ?? 'bg-slate-400'
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add src/lib/task-colors.ts
git commit -m "feat: add shared task status color helper"
```

---

## Task 4: Update `GET /api/tasks` + Add `DELETE`

**Files:**
- Modify: `src/app/api/tasks/route.ts`

**Changes:**
1. `GET`: add `WHERE archived_at IS NULL` (`.is('archived_at', null)`) — always exclude archived. The existing `status` filter handles the Active vs Completed split.
2. `DELETE`: new handler that permanently deletes a task by id, scoped to org.

- [ ] **Step 1: Update GET to exclude archived tasks**

In the query builder (after the `supabase.from('tasks').select(...)` line), add:
```typescript
.is('archived_at', null)
```
This goes before the conditional filters (`if (assigneeId)`, etc).

- [ ] **Step 2: Add DELETE handler at the bottom of the file**

```typescript
export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request, 'delete')
  if (isErrorResponse(auth)) return auth
  const { supabase, orgId } = auth

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add src/app/api/tasks/route.ts
git commit -m "feat: exclude archived tasks from GET, add DELETE endpoint"
```

---

## Task 5: Fix Project Page Profiles Bug

**Files:**
- Modify: `src/app/api/projects/[projectId]/route.ts`

**Problem:** `tasks(*, profiles:assignee_id(full_name, avatar_url))` fails because Supabase has no recognised FK from `tasks.assignee_id` to `profiles`. Fix: remove the nested profiles join, fetch profiles separately, merge.

- [ ] **Step 1: Strip profiles from the tasks select**

Change:
```typescript
tasks(*, profiles:assignee_id(full_name, avatar_url)),
```
To:
```typescript
tasks(*),
```

- [ ] **Step 2: After the main query succeeds, fetch and merge profiles**

Replace the `return NextResponse.json({ data })` with:

```typescript
if (error) return NextResponse.json({ error: error.message }, { status: 404 })

// Fetch assignee profiles separately (no direct FK Supabase can follow)
const assigneeIds = [...new Set((data.tasks ?? []).map((t: { assignee_id: string | null }) => t.assignee_id).filter(Boolean))] as string[]
let profilesMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {}
if (assigneeIds.length > 0) {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', assigneeIds)
  if (profiles) {
    profilesMap = Object.fromEntries(profiles.map((p: { id: string; full_name: string | null; avatar_url: string | null }) => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]))
  }
}

const tasksWithProfiles = (data.tasks ?? []).map((task: { assignee_id: string | null; [key: string]: unknown }) => ({
  ...task,
  profiles: task.assignee_id ? profilesMap[task.assignee_id] ?? null : null,
}))

return NextResponse.json({ data: { ...data, tasks: tasksWithProfiles } })
```

- [ ] **Step 3: Remove the old bare `return` that was replaced**

The original `if (error)` + `return NextResponse.json({ data })` lines should now be fully replaced by the block above. Verify no duplicate return statements.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: no output

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/projects/[projectId]/route.ts"
git commit -m "fix: fetch task assignee profiles separately in project detail API"
```

---

## Task 6: Tasks Page — Tabs + Color Coding + Archive/Delete

**Files:**
- Modify: `src/app/(dashboard)/tasks/page.tsx`

This is the largest UI change. Replace the single flat list with two tabs (Active / Completed), add colored status dots to the inline Select, and add Archive + Delete icon buttons per row.

- [ ] **Step 1: Add new imports at the top**

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Archive, Trash2 } from 'lucide-react'
import { statusDot } from '@/lib/task-colors'
import { toast } from 'sonner'
```

- [ ] **Step 2: Add `activeTab` state and split task lists**

After the existing filter state declarations, add:
```typescript
const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active')
```

In `fetchTasks`, pass the status filter based on tab:
```typescript
// Replace the existing status filter logic with:
if (activeTab === 'completed') {
  params.set('status', 'done')
} else {
  if (statusFilter !== 'all') params.set('status', statusFilter)
  // Exclude done from active tab
  // We handle this client-side after fetch:
}
```

After fetch, filter client-side for the active tab:
```typescript
let filtered = data || []
if (activeTab === 'active') {
  filtered = filtered.filter((t: Task) => t.status !== 'done')
}
setTasks(filtered)
```

Add `activeTab` to the `fetchTasks` `useCallback` dependency array and the `useEffect` deps.

- [ ] **Step 3: Add `handleArchive` and `handleDelete` functions**

```typescript
const handleArchive = async (taskId: string) => {
  try {
    await apiFetch('/api/tasks', {
      method: 'PUT',
      body: JSON.stringify({ id: taskId, archived_at: new Date().toISOString() }),
    })
    toast.success('Task archived')
    fetchTasks()
  } catch { toast.error('Failed to archive task') }
}

const handleDelete = async (taskId: string) => {
  try {
    await apiFetch(`/api/tasks?id=${taskId}`, { method: 'DELETE' })
    toast.success('Task deleted')
    fetchTasks()
  } catch { toast.error('Failed to delete task') }
}
```

- [ ] **Step 4: Replace the status Select in the table to use colored dots**

Replace the current status `<Select>` cell with:
```tsx
<TableCell>
  <Select value={task.status} onValueChange={(v) => handleStatusChange(task.id, v)}>
    <SelectTrigger className="w-36 h-7 text-xs">
      <SelectValue>
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${statusDot(task.status)}`} />
          {task.status.replace(/_/g, ' ')}
        </span>
      </SelectValue>
    </SelectTrigger>
    <SelectContent>
      {['todo', 'in_progress', 'in_review', 'done', 'blocked'].map((s) => (
        <SelectItem key={s} value={s}>
          <span className="flex items-center gap-1.5 capitalize text-xs">
            <span className={`h-2 w-2 rounded-full ${statusDot(s)}`} />
            {s.replace(/_/g, ' ')}
          </span>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</TableCell>
```

- [ ] **Step 5: Add Archive + Delete columns to the table**

Add to `<TableHeader>`:
```tsx
<TableHead className="text-muted-foreground w-20">Actions</TableHead>
```

Add to each `<TableRow>` after the Time cell:
```tsx
<TableCell>
  <div className="flex items-center gap-1">
    <Button
      variant="ghost" size="sm"
      className="h-6 w-6 p-0 text-muted-foreground hover:text-orange-400"
      title="Archive task"
      onClick={() => handleArchive(task.id)}
    >
      <Archive className="h-3 w-3" />
    </Button>
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400" title="Delete task">
          <Trash2 className="h-3 w-3" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{task.title}"?</AlertDialogTitle>
          <AlertDialogDescription>This permanently deletes the task and all its time entries. This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => handleDelete(task.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</TableCell>
```

- [ ] **Step 6: Wrap the table in Tabs**

Replace:
```tsx
<div className="flex items-center gap-3 flex-wrap">
  {/* filters */}
</div>
{tasks.length === 0 ? (...) : (...table...)}
```

With:
```tsx
<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'completed')}>
  <div className="flex items-center justify-between flex-wrap gap-3">
    <TabsList>
      <TabsTrigger value="active">Active</TabsTrigger>
      <TabsTrigger value="completed">Completed</TabsTrigger>
    </TabsList>
    <div className="flex items-center gap-3 flex-wrap">
      {/* existing filter Selects — keep status filter only on active tab */}
      {activeTab === 'active' && (
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v) }}>
          {/* existing status select */}
        </Select>
      )}
      {/* client + project selects always visible */}
    </div>
  </div>
  <TabsContent value="active">
    {/* existing empty state / table */}
  </TabsContent>
  <TabsContent value="completed">
    {/* same empty state / table — same JSX, reuse */}
  </TabsContent>
</Tabs>
```

Note: Both tab contents render the same table JSX (same `tasks` state). The tab switch triggers a re-fetch via `activeTab` in deps.

- [ ] **Step 7: Type-check and build**

```bash
npx tsc --noEmit
```
Expected: no output

- [ ] **Step 8: Commit**

```bash
git add "src/app/(dashboard)/tasks/page.tsx"
git commit -m "feat: Active/Completed tabs, colored status, archive/delete on tasks page"
```

---

## Task 7: Kanban Card — Archive & Delete Buttons

**Files:**
- Modify: `src/components/projects/kanban-card.tsx`

Add Archive and Delete icon buttons to the non-draggable card footer. The card needs an `onArchive` and `onDelete` callback (both trigger `onTaskEdit` / parent re-fetch after action).

- [ ] **Step 1: Update imports**

Add to existing imports:
```typescript
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Archive, Trash2 } from 'lucide-react'
import { useApi } from '@/lib/hooks/use-api'
import { toast } from 'sonner'
```

- [ ] **Step 2: Add `useApi` hook and action handlers inside the component**

```typescript
const { apiFetch } = useApi()

const handleArchive = async () => {
  try {
    await apiFetch('/api/tasks', {
      method: 'PUT',
      body: JSON.stringify({ id: task.id, archived_at: new Date().toISOString() }),
    })
    toast.success('Task archived')
    onTaskEdit?.()
  } catch { toast.error('Failed to archive') }
}

const handleDelete = async () => {
  try {
    await apiFetch(`/api/tasks?id=${task.id}`, { method: 'DELETE' })
    toast.success('Task deleted')
    onTaskEdit?.()
  } catch { toast.error('Failed to delete') }
}
```

- [ ] **Step 3: Add buttons to the footer div (after TimerWidget)**

```tsx
<Button
  variant="ghost" size="sm"
  className="h-6 px-2 text-xs text-muted-foreground hover:text-orange-400"
  title="Archive"
  onClick={handleArchive}
>
  <Archive className="h-3 w-3" />
</Button>
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-red-400" title="Delete">
      <Trash2 className="h-3 w-3" />
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete "{task.title}"?</AlertDialogTitle>
      <AlertDialogDescription>Permanently deletes this task and all its time entries.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

- [ ] **Step 4: Update kanban board tasks filter**

In `src/components/projects/kanban-board.tsx`, the `tasks` prop comes from the project page which fetches all tasks. Archived tasks should not appear on the kanban. Add a filter in `KanbanBoard`:

In `getTasksByStatus`:
```typescript
const getTasksByStatus = useCallback(
  (status: string) => tasks.filter((t) => t.status === status && !t.archived_at),
  [tasks]
)
```

Note: The `Task` type in kanban-board.tsx will need `archived_at` added:
```typescript
type Task = Database['public']['Tables']['tasks']['Row'] & {
  profiles?: { full_name: string | null; avatar_url: string | null } | null
}
```
Since `archived_at` is now in the DB type `Row`, this is already included automatically.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```
Expected: no output

- [ ] **Step 6: Commit**

```bash
git add src/components/projects/kanban-card.tsx src/components/projects/kanban-board.tsx
git commit -m "feat: add archive/delete to kanban card, exclude archived from board"
```

---

## Task 8: Client Tasks Tab Component

**Files:**
- Create: `src/components/clients/tasks-tab.tsx`

Renders a tasks table filtered by `client_id`. Supports inline status change, archive, and delete. Reuses `statusDot` and `TimeEntryForm`.

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApi } from '@/lib/hooks/use-api'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/shared/status-badge'
import { TimeEntryForm } from '@/components/tasks/time-entry-form'
import { Skeleton } from '@/components/ui/skeleton'
import { Archive, Trash2, Calendar } from 'lucide-react'
import { statusDot } from '@/lib/task-colors'
import { toast } from 'sonner'
import type { Database } from '@/types/database'

type Task = Database['public']['Tables']['tasks']['Row'] & {
  projects?: { id: string; name: string } | null
  profiles?: { full_name: string | null; avatar_url: string | null } | null
}

interface Props {
  clientId: string
}

export function ClientTasksTab({ clientId }: Props) {
  const { apiFetch } = useApi()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active')

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ client_id: clientId })
      if (activeTab === 'completed') params.set('status', 'done')
      const { data } = await apiFetch(`/api/tasks?${params}`)
      let filtered = data || []
      if (activeTab === 'active') {
        filtered = filtered.filter((t: Task) => t.status !== 'done')
      }
      setTasks(filtered)
    } catch { toast.error('Failed to load tasks') }
    finally { setLoading(false) }
  }, [apiFetch, clientId, activeTab])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await apiFetch('/api/tasks', { method: 'PUT', body: JSON.stringify({ id: taskId, status: newStatus }) })
      fetchTasks()
    } catch { toast.error('Failed to update status') }
  }

  const handleArchive = async (taskId: string) => {
    try {
      await apiFetch('/api/tasks', { method: 'PUT', body: JSON.stringify({ id: taskId, archived_at: new Date().toISOString() }) })
      toast.success('Task archived')
      fetchTasks()
    } catch { toast.error('Failed to archive task') }
  }

  const handleDelete = async (taskId: string) => {
    try {
      await apiFetch(`/api/tasks?id=${taskId}`, { method: 'DELETE' })
      toast.success('Task deleted')
      fetchTasks()
    } catch { toast.error('Failed to delete task') }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['active', 'completed'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-sm rounded-md capitalize transition-colors ${
              activeTab === tab
                ? 'bg-accent text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No {activeTab} tasks for this client.</p>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Task</TableHead>
                <TableHead className="text-muted-foreground">Project</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Priority</TableHead>
                <TableHead className="text-muted-foreground">Assignee</TableHead>
                <TableHead className="text-muted-foreground">Due</TableHead>
                <TableHead className="text-muted-foreground">Time</TableHead>
                <TableHead className="text-muted-foreground w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id} className="border-border hover:bg-accent/50">
                  <TableCell className="font-medium text-foreground">{task.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{task.projects?.name || '—'}</TableCell>
                  <TableCell>
                    <Select value={task.status} onValueChange={(v) => handleStatusChange(task.id, v)}>
                      <SelectTrigger className="w-36 h-7 text-xs">
                        <SelectValue>
                          <span className="flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${statusDot(task.status)}`} />
                            {task.status.replace(/_/g, ' ')}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {['todo', 'in_progress', 'in_review', 'done', 'blocked'].map((s) => (
                          <SelectItem key={s} value={s}>
                            <span className="flex items-center gap-1.5 capitalize text-xs">
                              <span className={`h-2 w-2 rounded-full ${statusDot(s)}`} />
                              {s.replace(/_/g, ' ')}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><StatusBadge status={task.priority} /></TableCell>
                  <TableCell>
                    {task.profiles ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={task.profiles.avatar_url || ''} />
                          <AvatarFallback className="text-[9px] bg-muted">{task.profiles.full_name?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-muted-foreground">{task.profiles.full_name}</span>
                      </div>
                    ) : <span className="text-sm text-muted-foreground">Unassigned</span>}
                  </TableCell>
                  <TableCell>
                    {task.due_date ? (
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <TimeEntryForm taskId={task.id} taskTitle={task.title} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost" size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-orange-400"
                        title="Archive task"
                        onClick={() => handleArchive(task.id)}
                      >
                        <Archive className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400" title="Delete task">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete "{task.title}"?</AlertDialogTitle>
                            <AlertDialogDescription>Permanently deletes the task and all its time entries.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(task.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add src/components/clients/tasks-tab.tsx
git commit -m "feat: add ClientTasksTab component"
```

---

## Task 9: Wire Tasks Tab into Client Detail Page

**Files:**
- Modify: `src/app/(dashboard)/clients/[clientId]/page.tsx`

- [ ] **Step 1: Add import**

```typescript
import { ClientTasksTab } from '@/components/clients/tasks-tab'
```

- [ ] **Step 2: Add tab trigger**

In `<TabsList>`, after the `timesheets` trigger:
```tsx
<TabsTrigger value="tasks">Tasks</TabsTrigger>
```

- [ ] **Step 3: Add tab content**

After the `timesheets` `<TabsContent>` block:
```tsx
<TabsContent value="tasks" className="mt-6">
  <ClientTasksTab clientId={clientId} />
</TabsContent>
```

- [ ] **Step 4: Type-check and full build**

```bash
npx tsc --noEmit && npm run build 2>&1 | tail -20
```
Expected: clean types, successful build

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/clients/[clientId]/page.tsx"
git commit -m "feat: add Tasks tab to client detail page"
```

---

## Summary

| Task | What it delivers |
|---|---|
| 1 | `archived_at` column in DB |
| 2 | TypeScript types updated |
| 3 | Shared `statusDot` helper |
| 4 | API: archived excluded from GET, DELETE added |
| 5 | Project page: profiles bug fixed |
| 6 | Tasks page: Active/Completed tabs + color coding + archive/delete |
| 7 | Kanban card: archive/delete + board filters archived tasks |
| 8 | `ClientTasksTab` component |
| 9 | Tasks tab wired into client detail page |
