'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useApi } from '@/lib/hooks/use-api'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

interface Member { user_id: string; profiles: { id: string; full_name: string | null; avatar_url: string | null } | null }

interface TaskFormProps {
  projectId?: string
  projects?: { id: string; name: string }[]
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
  defaultStatus?: string
  onSuccess?: () => void
  trigger?: React.ReactNode
}

export function TaskForm({ projectId, projects, task, defaultStatus, onSuccess, trigger }: TaskFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || task?.project_id || '')
  const { apiFetch } = useApi()

  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || defaultStatus || 'todo',
    priority: task?.priority || 'medium',
    due_date: task?.due_date || '',
    assignee_id: task?.assignee_id || '',
    billable: task?.billable ?? true,
  })

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = { ...formData, due_date: formData.due_date || null, assignee_id: formData.assignee_id || null }
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const set = (k: string, v: string) => setFormData((p) => ({ ...p, [k]: v }))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button size="sm"><Plus className="mr-2 h-3 w-3" />Add Task</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{task ? 'Edit Task' : 'New Task'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input value={formData.title} onChange={(e) => set('title', e.target.value)} placeholder="Task title" required />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={formData.description} onChange={(e) => set('description', e.target.value)} placeholder="Details..." className="min-h-[60px]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={formData.priority} onValueChange={(v) => set('priority', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['low', 'medium', 'high', 'urgent'].map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={formData.due_date} onChange={(e) => set('due_date', e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Assignee</Label>
            <Select value={formData.assignee_id || 'unassigned'} onValueChange={(v) => set('assignee_id', v === 'unassigned' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    <span className="flex items-center gap-2">
                      <Avatar className="h-4 w-4"><AvatarImage src={m.profiles?.avatar_url || ''} /><AvatarFallback className="text-[8px]">{m.profiles?.full_name?.[0] || '?'}</AvatarFallback></Avatar>
                      {m.profiles?.full_name || m.user_id}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="task-billable"
              checked={formData.billable}
              onChange={(e) => setFormData((p) => ({ ...p, billable: e.target.checked }))}
              className="rounded"
            />
            <Label htmlFor="task-billable" className="cursor-pointer">Billable</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !formData.title.trim() || (!task && !selectedProjectId)}>{loading ? 'Saving...' : task ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
