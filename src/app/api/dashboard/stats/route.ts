import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, isErrorResponse } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (isErrorResponse(auth)) return auth
  const { supabase, orgId } = auth

  // Run all count queries in parallel
  const [clientsResult, projectsResult, tasksResult, emailsResult] = await Promise.all([
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId),
    supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'active'),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .in('status', ['todo', 'in_progress', 'in_review', 'blocked']),
    supabase
      .from('email_threads')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('is_read', false),
  ])

  return NextResponse.json({
    totalClients: clientsResult.count ?? 0,
    activeProjects: projectsResult.count ?? 0,
    pendingTasks: tasksResult.count ?? 0,
    unreadEmails: emailsResult.count ?? 0,
  })
}
