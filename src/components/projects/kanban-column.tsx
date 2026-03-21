'use client'

import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { TaskForm } from '@/components/tasks/task-form'

interface KanbanColumnProps {
  id: string
  title: string
  count: number
  projectId: string
  onTaskCreated: () => void
  children: React.ReactNode
}

export function KanbanColumn({ id, title, count, projectId, onTaskCreated, children }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 flex-shrink-0 flex-col rounded-lg border border-border bg-card/50',
        isOver && 'border-blue-500/50 bg-blue-500/5'
      )}
    >
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span className="text-xs text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{count}</span>
        </div>
        <TaskForm
          projectId={projectId}
          defaultStatus={id as 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done'}
          onSuccess={onTaskCreated}
          trigger={
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
              <Plus className="h-3 w-3" />
            </Button>
          }
        />
      </div>
      <div className="flex-1 space-y-2 p-2 min-h-[100px]">
        {children}
      </div>
    </div>
  )
}
