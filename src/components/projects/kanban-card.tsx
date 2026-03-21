'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/status-badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { TaskForm } from '@/components/tasks/task-form'
import { TimeEntryForm } from '@/components/tasks/time-entry-form'
import { TimerWidget } from '@/components/tasks/timer-widget'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Archive, Calendar, Pencil, Trash2 } from 'lucide-react'
import { useApi } from '@/lib/hooks/use-api'
import { toast } from 'sonner'
import type { Database } from '@/types/database'

type Task = Database['public']['Tables']['tasks']['Row'] & {
  profiles?: { full_name: string | null; avatar_url: string | null } | null
}

interface KanbanCardProps {
  task: Task
  isOverlay?: boolean
  onTaskEdit?: () => void
}

export function KanbanCard({ task, isOverlay, onTaskEdit }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
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

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn('rounded-lg border border-border bg-card p-3 cursor-grab active:cursor-grabbing', isDragging && 'opacity-50', isOverlay && 'shadow-xl border-blue-500/30')}
    >
      <p className="text-sm font-medium text-foreground">{task.title}</p>
      <div className="flex items-center justify-between mt-2">
        <StatusBadge status={task.priority} />
        <div className="flex items-center gap-2">
          {task.due_date && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {task.profiles && (
            <Avatar className="h-5 w-5">
              <AvatarImage src={task.profiles.avatar_url || ''} />
              <AvatarFallback className="text-[9px] bg-muted">{task.profiles.full_name?.[0] || '?'}</AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
      {/* Non-draggable footer */}
      <div
        className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <TaskForm
          projectId={task.project_id}
          task={{ id: task.id, project_id: task.project_id, title: task.title, description: task.description, status: task.status, priority: task.priority, due_date: task.due_date, assignee_id: task.assignee_id, billable: task.billable }}
          onSuccess={onTaskEdit}
          trigger={<Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground"><Pencil className="h-3 w-3" /></Button>}
        />
        <TimeEntryForm
          taskId={task.id}
          taskTitle={task.title}
          defaultBillable={task.billable}
          trigger={<Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground">Log</Button>}
        />
        <TimerWidget taskId={task.id} taskTitle={task.title} defaultBillable={task.billable} />
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
      </div>
    </div>
  )
}
