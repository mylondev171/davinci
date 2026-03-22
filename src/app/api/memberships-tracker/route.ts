import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, isErrorResponse } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (isErrorResponse(auth)) return auth
  const { orgId } = auth

  const adminSupabase = createAdminClient()

  const { data, error } = await adminSupabase
    .from('service_memberships')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const flaggedCount = data?.filter((m) => m.flagged_for_removal).length || 0

  // Fetch owner profiles separately
  const ownerIds = [...new Set(data?.map((m) => m.owner_id).filter(Boolean))] as string[]
  let ownersMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {}
  if (ownerIds.length > 0) {
    const { data: profiles } = await adminSupabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', ownerIds)
    if (profiles) {
      ownersMap = Object.fromEntries(profiles.map((p) => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]))
    }
  }

  const dataWithOwners = data?.map((m) => ({
    ...m,
    owner: m.owner_id ? ownersMap[m.owner_id] || null : null,
  }))

  return NextResponse.json({ data: dataWithOwners, flaggedCount })
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (isErrorResponse(auth)) return auth
  const { user, orgId } = auth

  const body = await request.json()
  const { service_name, service_url, membership_level, cost, billing_cycle, flagged_for_removal, owner_id } = body

  if (!service_name) {
    return NextResponse.json({ error: 'service_name is required' }, { status: 400 })
  }

  const adminSupabase = createAdminClient()

  const insertData: Record<string, unknown> = {
    org_id: orgId,
    created_by: user.id,
    service_name,
    service_url: service_url || null,
    membership_level: membership_level || null,
    cost: cost != null ? cost : null,
    billing_cycle: billing_cycle || null,
    flagged_for_removal: flagged_for_removal || false,
    owner_id: owner_id || null,
  }

  if (flagged_for_removal) {
    insertData.flagged_at = new Date().toISOString()
  }

  const { data, error } = await adminSupabase
    .from('service_memberships')
    .insert(insertData)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}
