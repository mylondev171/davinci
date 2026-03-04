import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, isErrorResponse } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (isErrorResponse(auth)) return auth
  const { supabase, orgId } = auth

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status')
  const clientId = searchParams.get('client_id')

  let query = supabase
    .from('projects')
    .select('*, clients(id, company_name), tasks(id, status)', { count: 'exact' })
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })

  if (search) query = query.ilike('name', `%${search}%`)
  if (status) query = query.eq('status', status)
  if (clientId) query = query.eq('client_id', clientId)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, count })
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, 'create')
  if (isErrorResponse(auth)) return auth
  const { user, supabase, orgId } = auth

  const body = await request.json()

  const { data, error } = await supabase
    .from('projects')
    .insert({ ...body, org_id: orgId, created_by: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activities').insert({
    org_id: orgId,
    project_id: data.id,
    client_id: body.client_id || null,
    actor_id: user.id,
    activity_type: 'project_created',
    title: `Created project ${data.name}`,
  })

  return NextResponse.json({ data }, { status: 201 })
}
