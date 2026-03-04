'use client'

import { useEffect, useState } from 'react'
import { useApi } from '@/lib/hooks/use-api'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDistanceToNow } from 'date-fns'
import {
  UserPlus, Edit, Mail, FileText, FolderPlus,
  CheckSquare, MessageSquare, Phone, Sparkles,
} from 'lucide-react'

const activityIcons: Record<string, typeof UserPlus> = {
  client_created: UserPlus,
  client_updated: Edit,
  status_changed: Edit,
  email_received: Mail,
  email_sent: Mail,
  note_added: MessageSquare,
  document_linked: FileText,
  project_created: FolderPlus,
  task_created: CheckSquare,
  task_completed: CheckSquare,
  task_status_changed: CheckSquare,
  call_logged: Phone,
  ai_insight: Sparkles,
}

interface Activity {
  id: string
  activity_type: string
  title: string
  description: string | null
  created_at: string
  profiles?: { full_name: string | null; avatar_url: string | null }
}

interface ActivityTimelineProps {
  clientId?: string
  projectId?: string
}

export function ActivityTimeline({ clientId, projectId }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const { apiFetch } = useApi()

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const params = new URLSearchParams()
        if (clientId) params.set('client_id', clientId)
        if (projectId) params.set('project_id', projectId)
        const { data } = await apiFetch(`/api/activities?${params}`)
        setActivities(data || [])
      } catch (error) {
        console.error('Error fetching activities:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchActivities()
  }, [apiFetch, clientId, projectId])

  if (loading) return <LoadingSpinner />

  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No activity yet.</p>
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => {
        const Icon = activityIcons[activity.activity_type] || Edit
        const profile = activity.profiles
        return (
          <div key={activity.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="rounded-full bg-accent p-2">
                <Icon className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="flex-1 w-px bg-border" />
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2">
                {profile && (
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={profile.avatar_url || ''} />
                    <AvatarFallback className="text-[10px] bg-muted">
                      {profile.full_name?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                )}
                <span className="text-sm text-foreground">{activity.title}</span>
              </div>
              {activity.description && (
                <p className="mt-1 text-xs text-muted-foreground">{activity.description}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
