import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, isErrorResponse } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (isErrorResponse(auth)) return auth
  const { supabase, orgId } = auth

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')
  const projectId = searchParams.get('project_id')
  const taskId = searchParams.get('task_id')

  let query = supabase
    .from('notes')
    .select('*, profiles:author_id(full_name, avatar_url)')
    .eq('org_id', orgId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)
  if (projectId) query = query.eq('project_id', projectId)
  if (taskId) query = query.eq('task_id', taskId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, 'create')
  if (isErrorResponse(auth)) return auth
  const { user, supabase, orgId } = auth

  const body = await request.json()

  const { data, error } = await supabase
    .from('notes')
    .insert({ ...body, org_id: orgId, author_id: user.id })
    .select('*, profiles:author_id(full_name, avatar_url)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activities').insert({
    org_id: orgId,
    client_id: body.client_id || null,
    project_id: body.project_id || null,
    task_id: body.task_id || null,
    actor_id: user.id,
    activity_type: 'note_added',
    title: 'Added a note',
    description: body.content?.substring(0, 100),
  })

  return NextResponse.json({ data }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const auth = await authenticateRequest(request, 'update')
  if (isErrorResponse(auth)) return auth
  const { supabase } = auth

  const body = await request.json()
  const { id, ...updates } = body

  const { data, error } = await supabase
    .from('notes')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request, 'delete')
  if (isErrorResponse(auth)) return auth
  const { supabase } = auth

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
