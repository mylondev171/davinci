import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, isErrorResponse } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (isErrorResponse(auth)) return auth
  const { supabase, orgId } = auth

  const { searchParams } = new URL(request.url)
  const assigneeId = searchParams.get('assignee_id')
  const status = searchParams.get('status')
  const projectId = searchParams.get('project_id')

  const archived = searchParams.get('archived') === 'true'

  let query = supabase
    .from('tasks')
    .select('*, projects(id, name, clients(id, company_name))')
    .eq('org_id', orgId)
    .order('due_date', { ascending: true, nullsFirst: false })

  if (archived) {
    query = query.not('archived_at', 'is', null)
  } else {
    query = query.is('archived_at', null)
  }

  const clientId = searchParams.get('client_id')

  if (assigneeId) query = query.eq('assignee_id', assigneeId)
  if (status) query = query.eq('status', status)
  if (projectId) query = query.eq('project_id', projectId)
  if (clientId) {
    const { data: projects } = await supabase.from('projects').select('id').eq('client_id', clientId).eq('org_id', orgId)
    if (!projects?.length) return NextResponse.json({ data: [] })
    query = query.in('project_id', projects.map((p) => p.id))
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch assignee profiles separately
  const assigneeIds = [...new Set(data?.map(t => t.assignee_id).filter(Boolean))]
  let profilesMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {}
  if (assigneeIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', assigneeIds)
    if (profiles) {
      profilesMap = Object.fromEntries(profiles.map(p => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]))
    }
  }

  const tasksWithProfiles = data?.map(task => ({
    ...task,
    profiles: task.assignee_id ? profilesMap[task.assignee_id] || null : null,
  }))

  return NextResponse.json({ data: tasksWithProfiles })
}

export async function PUT(request: NextRequest) {
  const auth = await authenticateRequest(request, 'update')
  if (isErrorResponse(auth)) return auth
  const { user, supabase, orgId } = auth

  const body = await request.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // If completing a task, set completed_at
  if (updates.status === 'done') {
    updates.completed_at = new Date().toISOString()
  } else if (updates.status && updates.status !== 'done') {
    updates.completed_at = null
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .eq('org_id', orgId)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log activity for status changes
  if (updates.status) {
    const activityType = updates.status === 'done' ? 'task_completed' : 'task_status_changed'
    await supabase.from('activities').insert({
      org_id: orgId,
      project_id: data.project_id,
      task_id: data.id,
      actor_id: user.id,
      activity_type: activityType,
      title: updates.status === 'done'
        ? `Completed task "${data.title}"`
        : `Changed task "${data.title}" to ${updates.status.replace('_', ' ')}`,
    })
  }

  return NextResponse.json({ data })
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request, 'delete')
  if (isErrorResponse(auth)) return auth
  const { supabase, orgId } = auth

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
