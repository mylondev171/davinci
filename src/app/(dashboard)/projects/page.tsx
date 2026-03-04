'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useApi } from '@/lib/hooks/use-api'
import { useOrg } from '@/providers/org-provider'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { ProjectForm } from '@/components/projects/project-form'
import { Button } from '@/components/ui/button'
import { FolderKanban, Search, Calendar, LayoutGrid, List } from 'lucide-react'
import type { Database } from '@/types/database'

type Project = Database['public']['Tables']['projects']['Row'] & {
  clients?: { id: string; company_name: string } | null
  tasks?: { id: string; status: string }[]
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [layout, setLayout] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('projectsLayout') as 'grid' | 'list') || 'grid'
    }
    return 'grid'
  })
  const router = useRouter()
  const { apiFetch } = useApi()
  const { currentOrg } = useOrg()

  const fetchProjects = useCallback(async () => {
    if (!currentOrg) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const { data } = await apiFetch(`/api/projects?${params}`)
      setProjects(data || [])
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }, [apiFetch, currentOrg, search, statusFilter])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Projects</h1>
        <p className="text-muted-foreground">Manage your projects and deliverables</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="planning">Planning</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center border border-border rounded-md">
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded-r-none ${layout === 'grid' ? 'bg-accent text-foreground' : 'text-muted-foreground'}`}
            onClick={() => { setLayout('grid'); localStorage.setItem('projectsLayout', 'grid') }}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded-l-none ${layout === 'list' ? 'bg-accent text-foreground' : 'text-muted-foreground'}`}
            onClick={() => { setLayout('list'); localStorage.setItem('projectsLayout', 'list') }}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
        <ProjectForm onSuccess={fetchProjects} />
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create your first project to start tracking deliverables."
        />
      ) : (
        layout === 'grid' ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const totalTasks = project.tasks?.length || 0
              const doneTasks = project.tasks?.filter((t) => t.status === 'done').length || 0
              return (
                <Card
                  key={project.id}
                  className="border-border bg-card cursor-pointer hover:border-accent-foreground/20 transition-colors"
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-foreground">{project.name}</h3>
                      <StatusBadge status={project.priority} />
                    </div>
                    {project.clients && (
                      <p className="text-xs text-muted-foreground mb-2">{project.clients.company_name}</p>
                    )}
                    {project.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{project.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <StatusBadge status={project.status} />
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {project.due_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(project.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        {totalTasks > 0 && (
                          <span>{doneTasks}/{totalTasks} tasks</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {projects.map((project) => {
              const totalTasks = project.tasks?.length || 0
              const doneTasks = project.tasks?.filter((t) => t.status === 'done').length || 0
              return (
                <Card
                  key={project.id}
                  className="border-border bg-card cursor-pointer hover:border-accent-foreground/20 transition-colors"
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  <CardContent className="flex items-center gap-4 py-3 px-4">
                    <h3 className="font-semibold text-foreground min-w-[180px] flex-shrink-0">{project.name}</h3>
                    <span className="text-xs text-muted-foreground min-w-[120px] truncate">
                      {project.clients?.company_name || '\u2014'}
                    </span>
                    <StatusBadge status={project.status} />
                    <StatusBadge status={project.priority} />
                    {project.due_date && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                        <Calendar className="h-3 w-3" />
                        {new Date(project.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    {totalTasks > 0 && (
                      <span className="text-xs text-muted-foreground ml-auto">{doneTasks}/{totalTasks} tasks</span>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
