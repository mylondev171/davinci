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
    .from('projects')
    .select(`
      *,
      clients(id, company_name),
      tasks(*, profiles:assignee_id(full_name, avatar_url)),
      milestones(*),
      project_members(user_id, role, profiles:user_id(full_name, avatar_url))
    `)
    .eq('id', projectId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  return NextResponse.json({ data })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await authenticateRequest(request, 'update')
  if (isErrorResponse(auth)) return auth
  const { user, supabase, orgId } = auth

  const { projectId } = await params
  const body = await request.json()

  const { data, error } = await supabase
    .from('projects')
    .update(body)
    .eq('id', projectId)
    .eq('org_id', orgId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activities').insert({
    org_id: orgId,
    project_id: projectId,
    actor_id: user.id,
    activity_type: 'project_updated',
    title: `Updated project ${data.name}`,
  })

  return NextResponse.json({ data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await authenticateRequest(request, 'delete')
  if (isErrorResponse(auth)) return auth
  const { supabase, orgId } = auth

  const { projectId } = await params
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('org_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
