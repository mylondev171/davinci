# Time Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add time tracking to tasks — manual entry + live timer, billable/non-billable, task assignees, and a per-client timesheet tab with CSV/PDF export.

**Architecture:** A new `time_entries` Supabase table stores individual time logs per task. APIs follow the existing `authenticateRequest` + `apiFetch` pattern. Four new UI components handle logging, timing, and reporting. The timesheet lives as a new tab on the client detail page.

**Tech Stack:** Next.js 16 App Router, Supabase, shadcn/ui, Tailwind, jspdf + jspdf-autotable

**Spec:** `docs/superpowers/specs/2026-03-19-time-tracking-design.md`

---

## File Map

### New Files
- `supabase/migrations/00021_create_time_entries.sql` — DB table + RLS
- `src/app/api/memberships/route.ts` — GET org members (for assignee dropdown)
- `src/app/api/time-entries/route.ts` — POST + GET time entries
- `src/app/api/time-entries/[id]/route.ts` — PATCH + DELETE time entry
- `src/components/tasks/time-entry-form.tsx` — modal for creating/editing time entries
- `src/components/tasks/timer-widget.tsx` — start/stop timer per task
- `src/components/clients/timesheet-tab.tsx` — client timesheet table + filters + export

### Modified Files
- `src/components/tasks/task-form.tsx` — add Assignee dropdown
- `src/components/projects/kanban-card.tsx` — add Log Time button + TimerWidget
- `src/app/(dashboard)/tasks/page.tsx` — add Log Time button + TimerWidget column
- `src/app/(dashboard)/clients/[clientId]/page.tsx` — add Timesheets tab

---

## Task 1: Install Dependencies

**Files:** `package.json`

- [ ] **Step 1: Install jspdf and jspdf-autotable**

```bash
cd "C:/Users/mylon/OneDrive/Desktop/Projects/AI Sites/geminicrmpms"
npm install jspdf jspdf-autotable
```

Expected: packages appear in `package.json` dependencies, no errors.

- [ ] **Step 2: Verify install**

```bash
node -e "require('jspdf'); require('jspdf-autotable'); console.log('ok')"
```

Expected: prints `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add jspdf and jspdf-autotable for PDF export"
```

---

## Task 2: Database Migration

**Files:**
- Create: `supabase/migrations/00021_create_time_entries.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/00021_create_time_entries.sql

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

CREATE INDEX idx_time_entries_org_id     ON time_entries(org_id);
CREATE INDEX idx_time_entries_task_id    ON time_entries(task_id);
CREATE INDEX idx_time_entries_project_id ON time_entries(project_id);
CREATE INDEX idx_time_entries_user_id    ON time_entries(user_id);
CREATE INDEX idx_time_entries_date       ON time_entries(org_id, date);

-- updated_at trigger (reuse existing function — defined in 00014_create_updated_at_trigger.sql)
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- SELECT: any org member can read entries for their org
CREATE POLICY "time_entries_select" ON time_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE user_id = auth.uid() AND org_id = time_entries.org_id
    )
  );

-- INSERT: org members can insert; user_id must be themselves
CREATE POLICY "time_entries_insert" ON time_entries
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE user_id = auth.uid() AND org_id = time_entries.org_id
    )
  );

-- UPDATE: owners/admins can update any; members only their own
CREATE POLICY "time_entries_update" ON time_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE user_id = auth.uid()
        AND org_id = time_entries.org_id
        AND (role IN ('owner', 'admin') OR user_id = time_entries.user_id)
    )
  );

-- DELETE: owners/admins can delete any; members only their own
CREATE POLICY "time_entries_delete" ON time_entries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE user_id = auth.uid()
        AND org_id = time_entries.org_id
        AND (role IN ('owner', 'admin') OR user_id = time_entries.user_id)
    )
  );
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use the Supabase MCP tool: `mcp__claude_ai_Supabase__apply_migration` with the SQL above. Confirm it applies without errors.

- [ ] **Step 3: Verify table exists**

Use `mcp__claude_ai_Supabase__list_tables` and confirm `time_entries` appears.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00021_create_time_entries.sql
git commit -m "feat: add time_entries table with RLS policies"
```

---

## Task 3: GET /api/memberships Route

**Files:**
- Create: `src/app/api/memberships/route.ts`

The team settings page fetches members directly via the Supabase client. We need an API route so client components can fetch org members for the assignee dropdown without direct DB access.

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/memberships/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, isErrorResponse } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (isErrorResponse(auth)) return auth
  const { orgId } = auth

  const adminSupabase = createAdminClient()
  const { data, error } = await adminSupabase
    .from('memberships')
    .select('user_id, role, profiles:user_id(full_name, avatar_url)')
    .eq('org_id', orgId)
    .order('role')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}
```

- [ ] **Step 2: Test in browser**

Start dev server (`npm run dev`), navigate to any page, open browser console and run:
```js
fetch('/api/memberships', { headers: { 'x-org-id': '<your-org-id>' } })
  .then(r => r.json()).then(console.log)
```
Expected: `{ data: [{ user_id, role, profiles: { full_name, avatar_url } }, ...] }`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/memberships/route.ts
git commit -m "feat: add GET /api/memberships for assignee dropdown"
```

---

## Task 4: Time Entries API Routes

**Files:**
- Create: `src/app/api/time-entries/route.ts`
- Create: `src/app/api/time-entries/[id]/route.ts`

- [ ] **Step 1: Create POST + GET route**

```typescript
// src/app/api/time-entries/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, isErrorResponse } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, 'create')
  if (isErrorResponse(auth)) return auth
  const { user, supabase, orgId } = auth

  const body = await request.json()
  const { task_id, date, hours, note, billable } = body

  if (!task_id || !date || !hours) {
    return NextResponse.json({ error: 'task_id, date, and hours are required' }, { status: 400 })
  }

  // Derive project_id from task to prevent client spoofing
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('project_id')
    .eq('id', task_id)
    .eq('org_id', orgId)
    .single()

  if (taskError || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      org_id: orgId,
      task_id,
      project_id: task.project_id,
      user_id: user.id,
      date,
      hours,
      note: note || null,
      billable: billable ?? true,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (isErrorResponse(auth)) return auth
  const { supabase, orgId } = auth

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')
  const projectId = searchParams.get('project_id')
  const userId = searchParams.get('user_id')
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  const billable = searchParams.get('billable')

  let query = supabase
    .from('time_entries')
    .select(`
      *,
      tasks(id, title),
      projects(id, name, client_id),
      profiles:user_id(full_name, avatar_url)
    `)
    .eq('org_id', orgId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (projectId) query = query.eq('project_id', projectId)
  if (userId) query = query.eq('user_id', userId)
  if (start) query = query.gte('date', start)
  if (end) query = query.lte('date', end)
  if (billable === 'true') query = query.eq('billable', true)
  if (billable === 'false') query = query.eq('billable', false)

  // Scope by client_id via DB subquery (not JS post-filter)
  if (clientId) {
    const { data: projectIds } = await supabase
      .from('projects')
      .select('id')
      .eq('client_id', clientId)
      .eq('org_id', orgId)
    const ids = (projectIds || []).map(p => p.id)
    if (ids.length === 0) return NextResponse.json({ data: [] })
    query = query.in('project_id', ids)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data || [] })
}
```

- [ ] **Step 2: Create PATCH + DELETE route**

```typescript
// src/app/api/time-entries/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, isErrorResponse } from '@/lib/api-auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (isErrorResponse(auth)) return auth
  const { user, supabase, orgId, role } = auth

  const { id } = await params
  const body = await request.json()
  const { hours, note, date, billable } = body

  // Ownership check: members can only edit their own entries
  const { data: existing } = await supabase
    .from('time_entries')
    .select('user_id')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (role === 'member' && existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}
  if (hours !== undefined) updates.hours = hours
  if (note !== undefined) updates.note = note
  if (date !== undefined) updates.date = date
  if (billable !== undefined) updates.billable = billable

  const { data, error } = await supabase
    .from('time_entries')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (isErrorResponse(auth)) return auth
  const { user, supabase, orgId, role } = auth

  const { id } = await params

  // Ownership check: members can only delete their own entries
  const { data: existing } = await supabase
    .from('time_entries')
    .select('user_id')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (role === 'member' && existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { error } = await supabase
    .from('time_entries')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId) // defense-in-depth: scope delete to org

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Verify build compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors in the new routes.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/time-entries/
git commit -m "feat: add time entries API (POST, GET, PATCH, DELETE)"
```

---

## Task 5: Assignee Dropdown in Task Form

**Files:**
- Modify: `src/components/tasks/task-form.tsx`

- [ ] **Step 1: Add member fetching and assignee field**

In `task-form.tsx`, extend the interface and form state, fetch members on mount, and add an Assignee select. The updated file:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApi } from '@/lib/hooks/use-api'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

interface Member {
  user_id: string
  role: string
  profiles: { full_name: string | null; avatar_url: string | null }
}

interface TaskFormProps {
  projectId: string
  task?: {
    id: string
    title: string
    description: string | null
    status: string
    priority: string
    due_date: string | null
    assignee_id: string | null
  }
  defaultStatus?: string
  onSuccess?: () => void
  trigger?: React.ReactNode
}

export function TaskForm({ projectId, task, defaultStatus, onSuccess, trigger }: TaskFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const { apiFetch } = useApi()

  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || defaultStatus || 'todo',
    priority: task?.priority || 'medium',
    due_date: task?.due_date || '',
    assignee_id: task?.assignee_id || '',
  })

  useEffect(() => {
    if (!open) return
    apiFetch('/api/memberships')
      .then(({ data }) => setMembers(data || []))
      .catch(() => {})
  }, [open, apiFetch])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        ...formData,
        due_date: formData.due_date || null,
        assignee_id: formData.assignee_id || null,
      }

      if (task) {
        await apiFetch('/api/tasks', {
          method: 'PUT',
          body: JSON.stringify({ id: task.id, ...payload }),
        })
        toast.success('Task updated')
      } else {
        await apiFetch(`/api/projects/${projectId}/tasks`, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        toast.success('Task created')
      }
      setOpen(false)
      setFormData({ title: '', description: '', status: defaultStatus || 'todo', priority: 'medium', due_date: '', assignee_id: '' })
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm">
            <Plus className="mr-2 h-3 w-3" />
            Add Task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'New Task'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Task title"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Details..."
              className="min-h-[60px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['low', 'medium', 'high', 'urgent'].map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Assignee</Label>
            <Select value={formData.assignee_id || 'unassigned'} onValueChange={(v) => setFormData({ ...formData, assignee_id: v === 'unassigned' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.profiles.full_name || m.user_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !formData.title.trim()}>
              {loading ? 'Saving...' : task ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Test**

Open a project, click "Add Task". Confirm the Assignee dropdown appears and lists org members. Create a task with an assignee. Confirm it saves (refresh page, re-open task — assignee should persist).

- [ ] **Step 3: Commit**

```bash
git add src/components/tasks/task-form.tsx
git commit -m "feat: add assignee dropdown to task form"
```

---

## Task 6: TimeEntryForm Component

**Files:**
- Create: `src/components/tasks/time-entry-form.tsx`

This modal handles both creating and editing a time entry.

- [ ] **Step 1: Create the component**

```typescript
// src/components/tasks/time-entry-form.tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useApi } from '@/lib/hooks/use-api'
import { toast } from 'sonner'

interface TimeEntryFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId: string
  taskTitle: string
  // Pre-fill values (from timer or for editing)
  prefillHours?: number
  prefillDate?: string
  // For editing an existing entry
  entryId?: string
  initialNote?: string
  initialBillable?: boolean
  onSuccess?: () => void
}

export function TimeEntryForm({
  open,
  onOpenChange,
  taskId,
  taskTitle,
  prefillHours,
  prefillDate,
  entryId,
  initialNote,
  initialBillable,
  onSuccess,
}: TimeEntryFormProps) {
  const { apiFetch } = useApi()
  const [loading, setLoading] = useState(false)
  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time

  const [form, setForm] = useState({
    date: prefillDate || today,
    hours: prefillHours?.toString() || '',
    note: initialNote || '',
    billable: initialBillable ?? true,
  })

  // Re-sync when prefill changes (e.g. timer stopped)
  useEffect(() => {
    if (open) {
      setForm({
        date: prefillDate || today,
        hours: prefillHours?.toString() || '',
        note: initialNote || '',
        billable: initialBillable ?? true,
      })
    }
  }, [open, prefillHours, prefillDate, initialNote, initialBillable, today])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const hours = parseFloat(form.hours)
    if (isNaN(hours) || hours <= 0 || hours > 24) {
      toast.error('Hours must be between 0.01 and 24')
      return
    }
    setLoading(true)
    try {
      if (entryId) {
        await apiFetch(`/api/time-entries/${entryId}`, {
          method: 'PATCH',
          body: JSON.stringify({ hours, note: form.note, date: form.date, billable: form.billable }),
        })
        toast.success('Time entry updated')
      } else {
        await apiFetch('/api/time-entries', {
          method: 'POST',
          body: JSON.stringify({ task_id: taskId, hours, note: form.note, date: form.date, billable: form.billable }),
        })
        toast.success('Time logged')
      }
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save time entry')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{entryId ? 'Edit Time Entry' : 'Log Time'}</DialogTitle>
          <p className="text-sm text-muted-foreground truncate">{taskTitle}</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="te-date">Date</Label>
              <Input
                id="te-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="te-hours">Hours</Label>
              <Input
                id="te-hours"
                type="number"
                step="0.01"
                min="0.01"
                max="24"
                placeholder="1.5"
                value={form.hours}
                onChange={(e) => setForm({ ...form, hours: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="te-note">Note</Label>
            <Textarea
              id="te-note"
              placeholder="What did you work on?"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="min-h-[60px]"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={form.billable}
              onClick={() => setForm({ ...form, billable: !form.billable })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.billable ? 'bg-blue-500' : 'bg-muted'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${form.billable ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
            <Label className="cursor-pointer" onClick={() => setForm({ ...form, billable: !form.billable })}>
              {form.billable ? 'Billable' : 'Non-billable'}
            </Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : entryId ? 'Update' : 'Log Time'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -10
```

Expected: no errors referencing `time-entry-form.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/tasks/time-entry-form.tsx
git commit -m "feat: add TimeEntryForm component for logging time"
```

---

## Task 7: TimerWidget Component

**Files:**
- Create: `src/components/tasks/timer-widget.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/components/tasks/timer-widget.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Timer, Square } from 'lucide-react'
import { TimeEntryForm } from './time-entry-form'
import { toast } from 'sonner'

const STORAGE_KEY = 'active_timer'
const MAX_RESUME_AGE_MS = 12 * 60 * 60 * 1000 // 12 hours

interface ActiveTimer {
  taskId: string
  taskTitle: string
  startedAt: string // ISO string
}

interface TimerWidgetProps {
  taskId: string
  taskTitle: string
  onTimeSaved?: () => void
}

function getActiveTimer(): ActiveTimer | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function setActiveTimer(timer: ActiveTimer | null) {
  if (timer) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timer))
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function calcHours(startedAt: string): number {
  const elapsedMs = Date.now() - new Date(startedAt).getTime()
  return Math.max(0.01, Math.ceil(elapsedMs / 36000) / 100)
}

export function TimerWidget({ taskId, taskTitle, onTimeSaved }: TimerWidgetProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [logFormOpen, setLogFormOpen] = useState(false)
  const [prefillHours, setPrefillHours] = useState<number | undefined>()
  const [confirmDialog, setConfirmDialog] = useState<{ otherTitle: string } | null>(null)

  // Initialize from localStorage on mount
  useEffect(() => {
    const timer = getActiveTimer()
    if (!timer) return

    const age = Date.now() - new Date(timer.startedAt).getTime()

    if (age > MAX_RESUME_AGE_MS) {
      setActiveTimer(null)
      toast.info('A previous timer was discarded (older than 12 hours)')
      return
    }

    if (timer.taskId === taskId) {
      // Resume this task's timer
      setIsRunning(true)
      setStartedAt(timer.startedAt)
      if (age > 60_000) {
        toast.info(`Resuming timer from ${Math.round(age / 60000)} min ago — was your browser closed?`)
      }
    }
  }, [taskId])

  // Cross-tab sync via storage event
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      const timer = e.newValue ? JSON.parse(e.newValue) as ActiveTimer : null
      if (timer?.taskId === taskId) {
        setIsRunning(true)
        setStartedAt(timer.startedAt)
      } else {
        setIsRunning(false)
        setStartedAt(null)
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [taskId])

  // Tick
  useEffect(() => {
    if (!isRunning || !startedAt) return
    const interval = setInterval(() => {
      setElapsed(Date.now() - new Date(startedAt).getTime())
    }, 1000)
    return () => clearInterval(interval)
  }, [isRunning, startedAt])

  const handleStart = useCallback(() => {
    const existing = getActiveTimer()
    if (existing && existing.taskId !== taskId) {
      setConfirmDialog({ otherTitle: existing.taskTitle })
      return
    }
    const now = new Date().toISOString()
    setActiveTimer({ taskId, taskTitle, startedAt: now })
    setStartedAt(now)
    setIsRunning(true)
    setElapsed(0)
  }, [taskId, taskTitle])

  const handleStop = useCallback(() => {
    if (!startedAt) return
    const hours = calcHours(startedAt)
    setActiveTimer(null)
    setIsRunning(false)
    setStartedAt(null)
    setElapsed(0)
    setPrefillHours(hours)
    setLogFormOpen(true)
  }, [startedAt])

  const handleConfirmSwitch = useCallback(() => {
    setConfirmDialog(null)
    setActiveTimer(null)
    const now = new Date().toISOString()
    setActiveTimer({ taskId, taskTitle, startedAt: now })
    setStartedAt(now)
    setIsRunning(true)
    setElapsed(0)
  }, [taskId, taskTitle])

  return (
    <>
      {isRunning ? (
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs text-orange-400 border-orange-400/30 hover:bg-orange-400/10"
          onClick={handleStop}
        >
          <Square className="h-3 w-3 mr-1 fill-orange-400" />
          {formatElapsed(elapsed)}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={handleStart}
        >
          <Timer className="h-3 w-3 mr-1" />
          Start
        </Button>
      )}

      {/* Confirm switching tasks */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-sm mx-4 space-y-4">
            <p className="text-sm text-foreground">
              Stop timing <span className="font-medium">"{confirmDialog.otherTitle}"</span> (time not saved) and start timing this task?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmDialog(null)}>Cancel</Button>
              <Button size="sm" onClick={handleConfirmSwitch}>Switch Timer</Button>
            </div>
          </div>
        </div>
      )}

      <TimeEntryForm
        open={logFormOpen}
        onOpenChange={setLogFormOpen}
        taskId={taskId}
        taskTitle={taskTitle}
        prefillHours={prefillHours}
        prefillDate={new Date().toLocaleDateString('en-CA')}
        onSuccess={onTimeSaved}
      />
    </>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/tasks/timer-widget.tsx
git commit -m "feat: add TimerWidget with localStorage timer and cross-tab sync"
```

---

## Task 8: Add Time Logging to Kanban Card

**Files:**
- Modify: `src/components/projects/kanban-card.tsx`

The kanban card is draggable, so we need to stop drag events from propagating from the buttons. Use `e.stopPropagation()` on button clicks.

- [ ] **Step 1: Update kanban-card.tsx**

Replace the file contents:

```typescript
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/status-badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Calendar, Clock } from 'lucide-react'
import { TimeEntryForm } from '@/components/tasks/time-entry-form'
import { TimerWidget } from '@/components/tasks/timer-widget'
import type { Database } from '@/types/database'

type Task = Database['public']['Tables']['tasks']['Row'] & {
  profiles?: { full_name: string | null; avatar_url: string | null } | null
}

interface KanbanCardProps {
  task: Task
  isOverlay?: boolean
}

export function KanbanCard({ task, isOverlay }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })
  const [logOpen, setLogOpen] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'rounded-lg border border-border bg-card p-3 cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50',
        isOverlay && 'shadow-xl border-blue-500/30'
      )}
    >
      <p className="text-sm font-medium text-foreground">{task.title}</p>
      <div className="flex items-center justify-between mt-2">
        <StatusBadge status={task.priority} />
        <div className="flex items-center gap-1">
          {task.due_date && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {task.profiles && (
            <Avatar className="h-5 w-5">
              <AvatarImage src={task.profiles.avatar_url || ''} />
              <AvatarFallback className="text-[9px] bg-muted">
                {task.profiles.full_name?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
      {/* Time tracking actions — stop drag propagation */}
      <div
        className="flex items-center gap-1 mt-2 pt-2 border-t border-border"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); setLogOpen(true) }}
        >
          <Clock className="h-3 w-3 mr-1" />
          Log
        </Button>
        <TimerWidget taskId={task.id} taskTitle={task.title} />
      </div>
      <TimeEntryForm
        open={logOpen}
        onOpenChange={setLogOpen}
        taskId={task.id}
        taskTitle={task.title}
      />
    </div>
  )
}
```

- [ ] **Step 2: Test**

Navigate to a project with a kanban board. Verify:
- Cards still drag correctly
- "Log" button opens the TimeEntryForm without triggering a drag
- "Start" timer button starts ticking
- Stopping the timer pre-fills the form with calculated hours

- [ ] **Step 3: Commit**

```bash
git add src/components/projects/kanban-card.tsx
git commit -m "feat: add Log Time and TimerWidget to kanban cards"
```

---

## Task 9: Add Time Logging to Tasks List Page

**Files:**
- Modify: `src/app/(dashboard)/tasks/page.tsx`

- [ ] **Step 1: Add Time Log column to tasks table**

Add an `Actions` column to the tasks table with "Log Time" button and `TimerWidget`. Key changes:
- Import `TimeEntryForm`, `TimerWidget`, `Clock`, `useState`
- Add a `logTarget` state: `{ taskId: string; taskTitle: string } | null`
- Add `Actions` column header
- In each row, add action cell with Log button + TimerWidget

Merge into **existing** imports (do not add duplicate React import — `useState` is already imported):

Add `Button` to the existing shadcn/ui import line:
```typescript
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'  // add this line
```

Add `Clock` to the existing lucide-react import:
```typescript
import { CheckSquare, Calendar, Clock } from 'lucide-react'
```

Add new component imports after existing imports:
```typescript
import { TimeEntryForm } from '@/components/tasks/time-entry-form'
import { TimerWidget } from '@/components/tasks/timer-widget'
```

Add state inside the component:
```typescript
const [logTarget, setLogTarget] = useState<{ taskId: string; taskTitle: string } | null>(null)
```

Add `Actions` to `<TableHead>`:
```tsx
<TableHead className="text-muted-foreground">Actions</TableHead>
```

Add action cell inside each `<TableRow>` after the Due Date cell:
```tsx
<TableCell>
  <div className="flex items-center gap-1">
    <Button
      size="sm"
      variant="ghost"
      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
      onClick={() => setLogTarget({ taskId: task.id, taskTitle: task.title })}
    >
      <Clock className="h-3 w-3 mr-1" />
      Log
    </Button>
    <TimerWidget taskId={task.id} taskTitle={task.title} />
  </div>
</TableCell>
```

Add `TimeEntryForm` below the table:
```tsx
{logTarget && (
  <TimeEntryForm
    open={!!logTarget}
    onOpenChange={(open) => { if (!open) setLogTarget(null) }}
    taskId={logTarget.taskId}
    taskTitle={logTarget.taskTitle}
    onSuccess={fetchTasks}
  />
)}
```

- [ ] **Step 2: Test**

Navigate to `/tasks`. Verify Log button and timer appear per row. Log time and confirm a toast appears.

- [ ] **Step 3: Commit**

```bash
git add src/app/'(dashboard)'/tasks/page.tsx
git commit -m "feat: add Log Time and TimerWidget to tasks list page"
```

---

## Task 10: Client Timesheet Tab

**Files:**
- Create: `src/components/clients/timesheet-tab.tsx`
- Modify: `src/app/(dashboard)/clients/[clientId]/page.tsx`

- [ ] **Step 1: Create the timesheet tab component**

```typescript
// src/components/clients/timesheet-tab.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApi } from '@/lib/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { TimeEntryForm } from '@/components/tasks/time-entry-form'
import { Clock, Download, Trash2, Edit } from 'lucide-react'
import { toast } from 'sonner'

interface TimeEntry {
  id: string
  date: string
  hours: number
  note: string | null
  billable: boolean
  user_id: string
  task_id: string
  tasks: { id: string; title: string } | null
  projects: { id: string; name: string; client_id: string | null } | null
  profiles: { full_name: string | null; avatar_url: string | null } | null
}

interface Project {
  id: string
  name: string
}

interface Member {
  user_id: string
  profiles: { full_name: string | null }
}

interface TimesheetTabProps {
  clientId: string
  clientName: string
  projects: Project[]
}

function getDefaultDateRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA')
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString('en-CA')
  return { start, end }
}

export function TimesheetTab({ clientId, clientName, projects }: TimesheetTabProps) {
  const { apiFetch } = useApi()
  const defaultRange = getDefaultDateRange()

  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filters, setFilters] = useState({
    start: defaultRange.start,
    end: defaultRange.end,
    project_id: 'all',
    user_id: 'all',
    billable: 'all',
  })

  const [editTarget, setEditTarget] = useState<TimeEntry | null>(null)

  const fetchEntries = useCallback(async (forExport = false) => {
    if (!forExport) setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ client_id: clientId })
      if (filters.start) params.set('start', filters.start)
      if (filters.end) params.set('end', filters.end)
      if (filters.project_id !== 'all') params.set('project_id', filters.project_id)
      if (filters.user_id !== 'all') params.set('user_id', filters.user_id)
      if (filters.billable !== 'all') params.set('billable', filters.billable)

      const { data } = await apiFetch(`/api/time-entries?${params}`)
      if (forExport) return data as TimeEntry[]
      setEntries(data || [])
    } catch (e) {
      setError('Failed to load timesheet')
    } finally {
      if (!forExport) setLoading(false)
    }
    return []
  }, [apiFetch, clientId, filters])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  useEffect(() => {
    apiFetch('/api/memberships')
      .then(({ data }) => setMembers(data || []))
      .catch(() => {})
  }, [apiFetch])

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/time-entries/${id}`, { method: 'DELETE' })
      toast.success('Entry deleted')
      fetchEntries()
    } catch {
      toast.error('Failed to delete entry')
    }
  }

  // Totals (based on current entries — which already reflect filters)
  const totalHours = entries.reduce((sum, e) => sum + Number(e.hours), 0)
  const billableHours = entries.filter(e => e.billable).reduce((sum, e) => sum + Number(e.hours), 0)
  const nonBillableHours = totalHours - billableHours

  const formatHours = (h: number) => `${h.toFixed(2)}h`

  // CSV Export
  const handleCsvExport = async () => {
    const data = await fetchEntries(true) as TimeEntry[]
    const rows = [
      ['Date', 'Project', 'Task', 'Team Member', 'Hours', 'Billable', 'Note'],
      ...data.map(e => [
        e.date,
        e.projects?.name || '',
        e.tasks?.title || '',
        e.profiles?.full_name || '',
        e.hours.toString(),
        e.billable ? 'Yes' : 'No',
        e.note || '',
      ]),
      [],
      ['', '', '', 'Total', formatHours(data.reduce((s, e) => s + Number(e.hours), 0)), '', ''],
    ]
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${clientName}-timesheet-${filters.start}-${filters.end}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // PDF Export
  const handlePdfExport = async () => {
    const data = await fetchEntries(true) as TimeEntry[]
    if (data.length > 1000) {
      toast.error('Too many rows for PDF (1000+ entries). Use CSV export or narrow the date range.')
      return
    }
    const { jsPDF } = await import('jspdf')
    await import('jspdf-autotable') // side-effect: patches jsPDF.prototype with .autoTable
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text(`${clientName} — Timesheet`, 14, 20)
    doc.setFontSize(10)
    doc.text(`${filters.start} to ${filters.end}`, 14, 28)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(doc as any).autoTable({
      startY: 35,
      head: [['Date', 'Project', 'Task', 'Team Member', 'Hours', 'Billable', 'Note']],
      body: data.map(e => [
        e.date,
        e.projects?.name || '',
        e.tasks?.title || '',
        e.profiles?.full_name || '',
        e.hours.toString(),
        e.billable ? 'Yes' : 'No',
        e.note || '',
      ]),
      foot: [['', '', '', 'Total', formatHours(data.reduce((s, e) => s + Number(e.hours), 0)), '', '']],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 30, 30] },
      footStyles: { fillColor: [50, 50, 50], fontStyle: 'bold' },
    })

    doc.save(`${clientName}-timesheet-${filters.start}-${filters.end}.pdf`)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">From</label>
          <Input
            type="date"
            value={filters.start}
            onChange={(e) => setFilters({ ...filters, start: e.target.value })}
            className="w-36 h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">To</label>
          <Input
            type="date"
            value={filters.end}
            onChange={(e) => setFilters({ ...filters, end: e.target.value })}
            className="w-36 h-8 text-sm"
          />
        </div>
        <Select value={filters.project_id} onValueChange={(v) => setFilters({ ...filters, project_id: v })}>
          <SelectTrigger className="w-40 h-8 text-sm"><SelectValue placeholder="All projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.user_id} onValueChange={(v) => setFilters({ ...filters, user_id: v })}>
          <SelectTrigger className="w-40 h-8 text-sm"><SelectValue placeholder="All members" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Members</SelectItem>
            {members.map(m => (
              <SelectItem key={m.user_id} value={m.user_id}>
                {m.profiles.full_name || m.user_id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.billable} onValueChange={(v) => setFilters({ ...filters, billable: v })}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">Billable only</SelectItem>
            <SelectItem value="false">Non-billable only</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" className="h-8" onClick={handleCsvExport}>
            <Download className="h-3 w-3 mr-1" />CSV
          </Button>
          <Button size="sm" variant="outline" className="h-8" onClick={handlePdfExport}>
            <Download className="h-3 w-3 mr-1" />PDF
          </Button>
        </div>
      </div>

      {/* Summary */}
      {entries.length > 0 && (
        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">Total: <span className="text-foreground font-medium">{formatHours(totalHours)}</span></span>
          <span className="text-muted-foreground">Billable: <span className="text-blue-400 font-medium">{formatHours(billableHours)}</span></span>
          <span className="text-muted-foreground">Non-billable: <span className="text-muted-foreground font-medium">{formatHours(nonBillableHours)}</span></span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <p className="text-sm text-red-400">{error}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => fetchEntries()}>Retry</Button>
          </CardContent>
        </Card>
      ) : entries.length === 0 ? (
        <EmptyState icon={Clock} title="No time logged" description="Log time on tasks in your projects to see it here." />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Date</TableHead>
                <TableHead className="text-muted-foreground">Project</TableHead>
                <TableHead className="text-muted-foreground">Task</TableHead>
                <TableHead className="text-muted-foreground">Team Member</TableHead>
                <TableHead className="text-muted-foreground text-right">Hours</TableHead>
                <TableHead className="text-muted-foreground">Billable</TableHead>
                <TableHead className="text-muted-foreground">Note</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id} className="border-border hover:bg-accent/50">
                  <TableCell className="text-sm text-foreground">
                    {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{entry.projects?.name || '—'}</TableCell>
                  <TableCell className="text-sm text-foreground">{entry.tasks?.title || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{entry.profiles?.full_name || '—'}</TableCell>
                  <TableCell className="text-sm text-foreground text-right font-mono">{Number(entry.hours).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={entry.billable ? 'text-blue-400 border-blue-400/30' : 'text-muted-foreground'}>
                      {entry.billable ? 'Billable' : 'Non-billable'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{entry.note || '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditTarget(entry)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-400"
                        onClick={() => handleDelete(entry.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit entry form */}
      {editTarget && (
        <TimeEntryForm
          open={!!editTarget}
          onOpenChange={(open) => { if (!open) setEditTarget(null) }}
          taskId={editTarget.task_id}
          taskTitle={editTarget.tasks?.title || 'Task'}
          entryId={editTarget.id}
          prefillHours={editTarget.hours}
          prefillDate={editTarget.date}
          initialNote={editTarget.note || ''}
          initialBillable={editTarget.billable}
          onSuccess={fetchEntries}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add Timesheets tab to client detail page**

In `src/app/(dashboard)/clients/[clientId]/page.tsx`, add the import at the top:
```typescript
import { TimesheetTab } from '@/components/clients/timesheet-tab'
```

In the `<TabsList>`, add after the Activity trigger:
```tsx
<TabsTrigger value="timesheets">Timesheets</TabsTrigger>
```

After the Activity `<TabsContent>`, add:
```tsx
<TabsContent value="timesheets" className="mt-6">
  <TimesheetTab
    clientId={clientId}
    clientName={client.company_name}
    projects={client.projects || []}
  />
</TabsContent>
```

- [ ] **Step 3: Test**

Navigate to a client detail page. Verify:
- "Timesheets" tab appears and is clickable
- Default date range = current month
- After logging time on a task linked to this client, it appears in the table
- Filters narrow the results
- Edit and delete work
- CSV downloads a valid file
- PDF downloads (test with < 1000 rows)

- [ ] **Step 4: Commit**

```bash
git add src/components/clients/timesheet-tab.tsx src/app/'(dashboard)'/clients/'[clientId]'/page.tsx
git commit -m "feat: add client Timesheets tab with CSV and PDF export"
```

---

## Task 11: Final Build Verification

- [ ] **Step 1: Full build**

```bash
cd "C:/Users/mylon/OneDrive/Desktop/Projects/AI Sites/geminicrmpms"
npm run build 2>&1 | tail -30
```

Expected: all pages compile, 0 TypeScript errors.

- [ ] **Step 2: Spot-check key flows**

Start dev server (`npm run dev`) and verify:
1. Create a task with an assignee → assignee shows on kanban card
2. Log time manually on a kanban card → entry appears in client timesheet
3. Start timer → timer ticks → stop → form pre-fills hours → save → appears in timesheet
4. Filter timesheet by project → results narrow
5. Download CSV → opens in Excel/Sheets with correct columns
6. Download PDF → renders with correct header and table
7. Delete a time entry → disappears from table

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete time tracking — assignees, logging, timer, client timesheets"
```
