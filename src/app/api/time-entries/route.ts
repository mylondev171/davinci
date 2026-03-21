import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, isErrorResponse } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (isErrorResponse(auth)) return auth
  const { supabase, orgId } = auth
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')
  const projectId = searchParams.get('project_id')
  const userId = searchParams.get('user_id')
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  const billable = searchParams.get('billable')

  let query = supabase
    .from('time_entries')
    .select('*, tasks(id, title), projects(id, name), profiles:user_id(id, full_name, avatar_url)')
    .eq('org_id', orgId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (projectId) query = query.eq('project_id', projectId)
  if (userId) query = query.eq('user_id', userId)
  if (start) query = query.gte('date', start)
  if (end) query = query.lte('date', end)
  if (billable !== null && billable !== '') query = query.eq('billable', billable === 'true')

  if (clientId) {
    const { data: projects } = await supabase
      .from('projects').select('id').eq('client_id', clientId).eq('org_id', orgId)
    if (!projects?.length) return NextResponse.json({ data: [] })
    query = query.in('project_id', projects.map((p) => p.id))
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, 'create')
  if (isErrorResponse(auth)) return auth
  const { user, supabase, orgId } = auth
  const body = await request.json()
  const { task_id, date, hours, note, billable } = body

  if (!task_id || !date || !hours) {
    return NextResponse.json({ error: 'task_id, date, and hours are required' }, { status: 400 })
  }

  // Derive project_id server-side
  const { data: task } = await supabase.from('tasks').select('project_id').eq('id', task_id).single()
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('time_entries')
    .insert({ org_id: orgId, task_id, project_id: task.project_id, user_id: user.id, date, hours, note: note || null, billable: billable ?? true })
    .select('*, tasks(id, title), projects(id, name), profiles:user_id(id, full_name, avatar_url)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
