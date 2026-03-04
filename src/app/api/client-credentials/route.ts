import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, isErrorResponse } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (isErrorResponse(auth)) return auth
  const { user, orgId } = auth

  const clientId = request.nextUrl.searchParams.get('client_id')
  const search = request.nextUrl.searchParams.get('search')

  const adminSupabase = createAdminClient()

  // Select fields: never return encrypted_password in list view
  // Join clients table to get company_name for the unified panel
  let query = adminSupabase
    .from('client_credentials')
    .select('id, org_id, client_id, created_by, platform_name, platform_url, username, poc, scope, created_at, updated_at, clients(company_name)')
    .eq('org_id', orgId)
    .or(`scope.eq.organization,and(scope.eq.personal,created_by.eq.${user.id})`)
    .order('created_at', { ascending: false })

  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  if (search) {
    query = query.or(`platform_name.ilike.%${search}%,username.ilike.%${search}%,poc.ilike.%${search}%`)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, 'create')
  if (isErrorResponse(auth)) return auth
  const { user, orgId } = auth

  const body = await request.json()
  const { client_id, platform_name, platform_url, username, password, poc, scope = 'organization' } = body

  if (!client_id || !platform_name || !username || !password) {
    return NextResponse.json({ error: 'client_id, platform_name, username, and password are required' }, { status: 400 })
  }

  const adminSupabase = createAdminClient()

  const { data, error } = await adminSupabase
    .from('client_credentials')
    .insert({
      org_id: orgId,
      client_id,
      created_by: user.id,
      platform_name,
      platform_url: platform_url || null,
      username,
      encrypted_password: password,
      poc: poc || null,
      scope,
    })
    .select('id, org_id, client_id, created_by, platform_name, platform_url, username, poc, scope, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}
