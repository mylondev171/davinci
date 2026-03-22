import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, isErrorResponse } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

type RouteContext = { params: Promise<{ membershipId: string }> }

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(request)
  if (isErrorResponse(auth)) return auth
  const { orgId } = auth
  const { membershipId } = await context.params

  const body = await request.json()
  const adminSupabase = createAdminClient()

  // Fetch current state to handle flag toggling logic
  const { data: existing } = await adminSupabase
    .from('service_memberships')
    .select('flagged_for_removal')
    .eq('id', membershipId)
    .eq('org_id', orgId)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.service_name !== undefined) updates.service_name = body.service_name
  if (body.service_url !== undefined) updates.service_url = body.service_url || null
  if (body.membership_level !== undefined) updates.membership_level = body.membership_level || null
  if (body.cost !== undefined) updates.cost = body.cost != null ? body.cost : null
  if (body.billing_cycle !== undefined) updates.billing_cycle = body.billing_cycle || null
  if (body.owner_id !== undefined) updates.owner_id = body.owner_id || null

  // Handle flag toggling
  if (body.flagged_for_removal !== undefined) {
    updates.flagged_for_removal = body.flagged_for_removal
    if (body.flagged_for_removal && !existing.flagged_for_removal) {
      // Toggling ON: set flagged_at
      updates.flagged_at = new Date().toISOString()
    } else if (!body.flagged_for_removal && existing.flagged_for_removal) {
      // Toggling OFF: clear flagged_at and last_reminder_sent_at
      updates.flagged_at = null
      updates.last_reminder_sent_at = null
    }
  }

  const { data, error } = await adminSupabase
    .from('service_memberships')
    .update(updates)
    .eq('id', membershipId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(request, 'delete')
  if (isErrorResponse(auth)) return auth
  const { orgId } = auth
  const { membershipId } = await context.params

  const adminSupabase = createAdminClient()

  const { error } = await adminSupabase
    .from('service_memberships')
    .delete()
    .eq('id', membershipId)
    .eq('org_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
