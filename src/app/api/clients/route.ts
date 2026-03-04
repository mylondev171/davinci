import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, isErrorResponse } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (isErrorResponse(auth)) return auth
  const { supabase, orgId } = auth

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = (page - 1) * limit
  const sortBy = searchParams.get('sort_by') || 'updated_at'
  const sortDir = searchParams.get('sort_dir') || 'desc'

  const allowedSortFields = ['company_name', 'industry', 'status', 'pipeline_stage', 'created_at', 'updated_at']
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'updated_at'

  let query = supabase
    .from('clients')
    .select('*, contacts(id, first_name, last_name, email, is_primary)', { count: 'exact' })
    .eq('org_id', orgId)
    .order(sortField, { ascending: sortDir === 'asc' })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.ilike('company_name', `%${search}%`)
  }
  if (status) {
    query = query.eq('status', status)
  }

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
    .from('clients')
    .insert({ ...body, org_id: orgId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activities').insert({
    org_id: orgId,
    client_id: data.id,
    actor_id: user.id,
    activity_type: 'client_created',
    title: `Created client ${data.company_name}`,
  })

  return NextResponse.json({ data }, { status: 201 })
}
