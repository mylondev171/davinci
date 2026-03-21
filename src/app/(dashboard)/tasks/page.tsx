'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useApi } from '@/lib/hooks/use-api'
import { useOrg } from '@/providers/org-provider'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { TimeEntryForm } from '@/components/tasks/time-entry-form'
import { CheckSquare, Calendar, Archive, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { statusDot } from '@/lib/task-colors'
import type { Database } from '@/types/database'

type Task = Database['public']['Tables']['tasks']['Row'] & {
  projects?: { id: string; name: string; clients?: { id: string; company_name: string } | null } | null
  profiles?: { full_name: string | null; avatar_url: string | null } | null
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active')
  const [statusFilter, setStatusFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string; client_id: string | null }[]>([])
  const router = useRouter()
  const { apiFetch } = useApi()
  const { currentOrg } = useOrg()

  useEffect(() => {
    if (!currentOrg) return
    apiFetch('/api/clients').then(({ data }) => setClients(data || [])).catch(() => {})
    apiFetch('/api/projects').then(({ data }) => setProjects(data || [])).catch(() => {})
  }, [currentOrg, apiFetch])

  const fetchTasks = useCallback(async () => {
    if (!currentOrg) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (activeTab === 'completed') {
        params.set('status', 'done')
      } else {
        if (statusFilter !== 'all') params.set('status', statusFilter)
      }
      if (clientFilter !== 'all') params.set('client_id', clientFilter)
      if (projectFilter !== 'all') params.set('project_id', projectFilter)
      const { data } = await apiFetch(`/api/tasks?${params}`)
      let filtered = data || []
      if (activeTab === 'active') {
        filtered = filtered.filter((t: Task) => t.status !== 'done')
      }
      setTasks(filtered)
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setLoading(false)
    }
  }, [apiFetch, currentOrg, activeTab, statusFilter, clientFilter, projectFilter])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await apiFetch('/api/tasks', { method: 'PUT', body: JSON.stringify({ id: taskId, status: newStatus }) })
      fetchTasks()
    } catch (error) { console.error('Error updating task:', error) }
  }

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

  const visibleProjects = clientFilter !== 'all'
    ? projects.filter((p) => p.client_id === clientFilter)
    : projects

  if (loading) return <LoadingSpinner />

  const tableContent = (
    tasks.length === 0 ? (
      <EmptyState icon={CheckSquare} title="No tasks found" description="No tasks match the current filters." />
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
              <TableHead className="text-muted-foreground">Due Date</TableHead>
              <TableHead className="text-muted-foreground">Time</TableHead>
              <TableHead className="text-muted-foreground w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.id} className="border-border hover:bg-accent/50">
                <TableCell className="font-medium text-foreground">{task.title}</TableCell>
                <TableCell>
                  {task.projects ? (
                    <span className="text-blue-400 cursor-pointer hover:underline text-sm" onClick={() => router.push(`/projects/${task.projects!.id}`)}>
                      {task.projects.name}
                    </span>
                  ) : '—'}
                </TableCell>
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
                          <AlertDialogTitle>Delete &quot;{task.title}&quot;?</AlertDialogTitle>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
        <p className="text-muted-foreground">All tasks across your projects</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'completed')}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-3 flex-wrap">
            {activeTab === 'active' && (
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v) }}>
                <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {['todo', 'in_progress', 'in_review', 'blocked'].map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={clientFilter} onValueChange={(v) => { setClientFilter(v); setProjectFilter('all') }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All clients" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All projects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {visibleProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="active">
          {tableContent}
        </TabsContent>
        <TabsContent value="completed">
          {tableContent}
        </TabsContent>
      </Tabs>
    </div>
  )
}
