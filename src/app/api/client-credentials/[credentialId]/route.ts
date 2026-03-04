import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, isErrorResponse } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

type RouteContext = { params: Promise<{ credentialId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(request)
  if (isErrorResponse(auth)) return auth
  const { user, orgId } = auth
  const { credentialId } = await context.params

  const adminSupabase = createAdminClient()

  const { data, error } = await adminSupabase
    .from('client_credentials')
    .select('*')
    .eq('id', credentialId)
    .eq('org_id', orgId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
  }

  // Personal-scoped credentials can only be revealed by the creator
  if (data.scope === 'personal' && data.created_by !== user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  return NextResponse.json({ data })
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(request)
  if (isErrorResponse(auth)) return auth
  const { user, orgId, role } = auth
  const { credentialId } = await context.params

  const adminSupabase = createAdminClient()

  // Fetch existing credential to check ownership
  const { data: existing } = await adminSupabase
    .from('client_credentials')
    .select('created_by, scope')
    .eq('id', credentialId)
    .eq('org_id', orgId)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
  }

  // Only creator can edit personal creds; org-scoped: creator or owner/admin
  if (existing.scope === 'personal' && existing.created_by !== user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }
  if (existing.scope === 'organization' && existing.created_by !== user.id && role === 'member') {
    return NextResponse.json({ error: 'Only the creator or an admin/owner can edit this credential' }, { status: 403 })
  }

  const body = await request.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.platform_name !== undefined) updates.platform_name = body.platform_name
  if (body.platform_url !== undefined) updates.platform_url = body.platform_url || null
  if (body.username !== undefined) updates.username = body.username
  if (body.password !== undefined) updates.encrypted_password = body.password
  if (body.poc !== undefined) updates.poc = body.poc || null
  if (body.scope !== undefined) updates.scope = body.scope

  const { data, error } = await adminSupabase
    .from('client_credentials')
    .update(updates)
    .eq('id', credentialId)
    .select('id, org_id, client_id, created_by, platform_name, platform_url, username, poc, scope, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(request)
  if (isErrorResponse(auth)) return auth
  const { user, orgId, role } = auth
  const { credentialId } = await context.params

  const adminSupabase = createAdminClient()

  const { data: existing } = await adminSupabase
    .from('client_credentials')
    .select('created_by, scope')
    .eq('id', credentialId)
    .eq('org_id', orgId)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
  }

  // Personal creds: creator can always delete. Org creds: need delete permission
  if (existing.scope === 'personal' && existing.created_by === user.id) {
    // Creator can always delete their own personal creds
  } else if (role === 'member') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { error } = await adminSupabase
    .from('client_credentials')
    .delete()
    .eq('id', credentialId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
