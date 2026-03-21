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
