'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useApi } from '@/lib/hooks/use-api'
import { toast } from 'sonner'
import { KanbanColumn } from './kanban-column'
import { KanbanCard } from './kanban-card'
import type { Database } from '@/types/database'

type Task = Database['public']['Tables']['tasks']['Row'] & {
  profiles?: { full_name: string | null; avatar_url: string | null } | null
}

const columns = [
  { id: 'todo', title: 'To Do' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'in_review', title: 'In Review' },
  { id: 'done', title: 'Done' },
] as const

interface KanbanBoardProps {
  tasks: Task[]
  onTaskUpdate: () => void
  projectId: string
}

export function KanbanBoard({ tasks, onTaskUpdate, projectId }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const { apiFetch } = useApi()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const getTasksByStatus = useCallback(
    (status: string) => tasks.filter((t) => t.status === status && !t.archived_at),
    [tasks]
  )

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id)
    if (task) setActiveTask(task)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return

    const taskId = active.id as string
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    // Determine target column
    let newStatus: string
    const overTask = tasks.find((t) => t.id === over.id)
    if (overTask) {
      newStatus = overTask.status
    } else {
      // Dropped on a column directly
      newStatus = over.id as string
    }

    if (task.status === newStatus) return

    try {
      await apiFetch('/api/tasks', {
        method: 'PUT',
        body: JSON.stringify({ id: taskId, status: newStatus }),
      })
      onTaskUpdate()
    } catch (error) {
      toast.error('Failed to update task')
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => {
          const columnTasks = getTasksByStatus(column.id)
          return (
            <KanbanColumn
              key={column.id}
              id={column.id}
              title={column.title}
              count={columnTasks.length}
              projectId={projectId}
              onTaskCreated={onTaskUpdate}
            >
              <SortableContext
                items={columnTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {columnTasks.map((task) => (
                  <KanbanCard key={task.id} task={task} onTaskEdit={onTaskUpdate} />
                ))}
              </SortableContext>
            </KanbanColumn>
          )
        })}
      </div>
      <DragOverlay>
        {activeTask ? <KanbanCard task={activeTask} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}
