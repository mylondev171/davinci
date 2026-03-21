'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useApi } from '@/lib/hooks/use-api'
import { useOrg } from '@/providers/org-provider'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { StatusBadge } from '@/components/shared/status-badge'
import { KanbanBoard } from '@/components/projects/kanban-board'
import { ProjectForm } from '@/components/projects/project-form'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ArrowLeft, Edit, Calendar, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Database } from '@/types/database'

type Task = Database['public']['Tables']['tasks']['Row'] & {
  profiles?: { full_name: string | null; avatar_url: string | null } | null
}

type Project = Database['public']['Tables']['projects']['Row'] & {
  clients?: { id: string; company_name: string } | null
  tasks: Task[]
  milestones?: { id: string; name: string; due_date: string | null; completed: boolean }[]
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const { apiFetch } = useApi()
  const { currentOrg } = useOrg()
  const { can } = usePermissions()

  const fetchProject = useCallback(async () => {
    try {
      const { data } = await apiFetch(`/api/projects/${projectId}`)
      setProject(data)
    } catch {
      toast.error('Failed to load project')
    } finally {
      setLoading(false)
    }
  }, [apiFetch, projectId])

  useEffect(() => {
    if (currentOrg) fetchProject()
  }, [fetchProject, currentOrg])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await apiFetch(`/api/projects/${projectId}`, { method: 'DELETE' })
      toast.success('Project deleted')
      router.push('/projects')
    } catch {
      toast.error('Failed to delete project')
      setDeleting(false)
    }
  }

  if (loading) return <LoadingSpinner />
  if (!project) return <p className="text-muted-foreground">Project not found.</p>

  const totalTasks = project.tasks?.length || 0
  const doneTasks = project.tasks?.filter((t) => t.status === 'done').length || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/projects')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={project.status} />
              <StatusBadge status={project.priority} />
              {project.clients && (
                <span
                  className="text-sm text-blue-400 cursor-pointer hover:underline"
                  onClick={() => router.push(`/clients/${project.clients!.id}`)}
                >
                  {project.clients.company_name}
                </span>
              )}
              {project.due_date && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Due {new Date(project.due_date).toLocaleDateString()}
                </span>
              )}
              {totalTasks > 0 && (
                <span className="text-sm text-muted-foreground">{doneTasks}/{totalTasks} tasks done</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ProjectForm
            project={project}
            onSuccess={fetchProject}
            trigger={<Button variant="outline" size="sm"><Edit className="mr-2 h-3 w-3" />Edit</Button>}
          />
          {can('delete') && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-red-400 border-red-400/30 hover:bg-red-400/10">
                  <Trash2 className="mr-2 h-3 w-3" />Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete &quot;{project.name}&quot;?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this project and all associated tasks. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {totalTasks > 0 && (
        <div className="w-full bg-accent rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${(doneTasks / totalTasks) * 100}%` }}
          />
        </div>
      )}

      {/* Kanban Board */}
      <KanbanBoard
        tasks={project.tasks || []}
        onTaskUpdate={fetchProject}
        projectId={projectId}
      />
    </div>
  )
}
