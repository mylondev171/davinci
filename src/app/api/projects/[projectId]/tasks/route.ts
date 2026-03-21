import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, isErrorResponse } from '@/lib/api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await authenticateRequest(request)
  if (isErrorResponse(auth)) return auth
  const { supabase } = auth

  const { projectId } = await params

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .is('archived_at', null)
    .order('position')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const assigneeIds = [...new Set(data?.map(t => t.assignee_id).filter(Boolean))] as string[]
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
    profiles: task.assignee_id ? profilesMap[task.assignee_id] ?? null : null,
  }))

  return NextResponse.json({ data: tasksWithProfiles })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await authenticateRequest(request, 'create')
  if (isErrorResponse(auth)) return auth
  const { user, supabase, orgId } = auth

  const { projectId } = await params
  const body = await request.json()

  // Get the project to find its client_id for the activity log
  const { data: project } = await supabase
    .from('projects')
    .select('client_id')
    .eq('id', projectId)
    .single()

  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...body, project_id: projectId, org_id: orgId })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch assignee profile separately
  let profiles = null
  if (data.assignee_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('id', data.assignee_id)
      .single()
    profiles = profile ? { full_name: profile.full_name, avatar_url: profile.avatar_url } : null
  }

  await supabase.from('activities').insert({
    org_id: orgId,
    project_id: projectId,
    client_id: project?.client_id || null,
    task_id: data.id,
    actor_id: user.id,
    activity_type: 'task_created',
    title: `Created task "${data.title}"`,
  })

  return NextResponse.json({ data: { ...data, profiles } }, { status: 201 })
}
