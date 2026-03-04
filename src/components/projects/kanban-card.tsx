'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/status-badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar } from 'lucide-react'
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
              <AvatarFallback className="text-[9px] bg-muted">
                {task.profiles.full_name?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </div>
  )
}
