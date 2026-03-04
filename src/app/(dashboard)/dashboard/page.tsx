'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Users, FolderKanban, CheckSquare, Mail, AlertTriangle, X, Edit, UserPlus, FileText, FolderPlus, MessageSquare, Phone, Sparkles } from 'lucide-react'
import { useApi } from '@/lib/hooks/use-api'
import { useOrg } from '@/providers/org-provider'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { formatDistanceToNow } from 'date-fns'

const activityIcons: Record<string, typeof Edit> = {
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

interface DashboardStats {
  totalClients: number
  activeProjects: number
  pendingTasks: number
  unreadEmails: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({ totalClients: 0, activeProjects: 0, pendingTasks: 0, unreadEmails: 0 })
  const [activities, setActivities] = useState<Activity[]>([])
  const [flaggedCount, setFlaggedCount] = useState(0)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [loading, setLoading] = useState(true)
  const { apiFetch } = useApi()
  const { currentOrg } = useOrg()
  const { isOwner } = usePermissions()

  const fetchDashboard = useCallback(async () => {
    try {
      const [statsData, activitiesData] = await Promise.all([
        apiFetch('/api/dashboard/stats'),
        apiFetch('/api/activities?limit=10'),
      ])
      setStats(statsData)
      setActivities(activitiesData.data || [])
    } catch {
      // Silently fail — dashboard still renders with 0s
    } finally {
      setLoading(false)
    }
  }, [apiFetch])

  const fetchFlaggedCount = useCallback(async () => {
    try {
      const { flaggedCount: count } = await apiFetch('/api/memberships-tracker')
      setFlaggedCount(count || 0)
    } catch {
      // Silently fail
    }
  }, [apiFetch])

  useEffect(() => {
    if (currentOrg) {
      fetchDashboard()
      if (isOwner) fetchFlaggedCount()
    }
  }, [fetchDashboard, fetchFlaggedCount, currentOrg, isOwner])

  const kpiCards = [
    {
      title: 'Total Clients',
      value: stats.totalClients,
      subtitle: stats.totalClients === 0 ? 'Get started by adding a client' : `${stats.totalClients} client${stats.totalClients !== 1 ? 's' : ''} tracked`,
      icon: Users,
      href: '/clients',
    },
    {
      title: 'Active Projects',
      value: stats.activeProjects,
      subtitle: stats.activeProjects === 0 ? 'No active projects yet' : `${stats.activeProjects} in progress`,
      icon: FolderKanban,
      href: '/projects',
    },
    {
      title: 'Pending Tasks',
      value: stats.pendingTasks,
      subtitle: stats.pendingTasks === 0 ? 'All caught up' : `${stats.pendingTasks} need${stats.pendingTasks === 1 ? 's' : ''} attention`,
      icon: CheckSquare,
      href: '/tasks',
    },
    {
      title: 'Unread Emails',
      value: stats.unreadEmails,
      subtitle: stats.unreadEmails === 0 ? 'Connect Gmail to sync' : `${stats.unreadEmails} unread`,
      icon: Mail,
      href: '/settings/integrations',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Flagged Memberships Banner */}
      {isOwner && flaggedCount > 0 && !bannerDismissed && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <span className="text-sm text-foreground">
              You have <strong>{flaggedCount}</strong> {flaggedCount === 1 ? 'membership' : 'memberships'} flagged for cancellation.
            </span>
            <Link href="/memberships">
              <Button variant="outline" size="sm" className="h-7 text-xs">
                Review
              </Button>
            </Link>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setBannerDismissed(true)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to your agency workspace</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card className="border-border bg-card hover:bg-accent/30 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {loading ? <span className="inline-block w-8 h-7 bg-muted animate-pulse rounded" /> : card.value}
                </div>
                <p className="text-xs text-muted-foreground">{card.subtitle}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Activity */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-1/4 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Activity from your team will appear here. Start by adding clients and creating projects.
            </p>
          ) : (
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
                    <div className="flex-1 pb-2">
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
