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
    .select('*, profiles:assignee_id(full_name, avatar_url)')
    .eq('project_id', projectId)
    .order('position')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
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
    .select('*, profiles:assignee_id(full_name, avatar_url)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activities').insert({
    org_id: orgId,
    project_id: projectId,
    client_id: project?.client_id || null,
    task_id: data.id,
    actor_id: user.id,
    activity_type: 'task_created',
    title: `Created task "${data.title}"`,
  })

  return NextResponse.json({ data }, { status: 201 })
}
