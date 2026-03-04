import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, isErrorResponse } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await authenticateRequest(request, 'manage_roles')
  if (isErrorResponse(auth)) return auth
  const { orgId, role: callerRole } = auth

  const { userId: targetUserId } = await params
  const { role: newRole } = await request.json()

  if (!newRole || !['admin', 'member'].includes(newRole)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Only owners can promote to admin
  if (newRole === 'admin' && callerRole !== 'owner') {
    return NextResponse.json({ error: 'Only owners can promote to admin' }, { status: 403 })
  }

  const adminSupabase = createAdminClient()

  // Can't change the owner's role
  const { data: targetMembership } = await adminSupabase
    .from('memberships')
    .select('role')
    .eq('user_id', targetUserId)
    .eq('org_id', orgId)
    .single()

  if (!targetMembership) {
    return NextResponse.json({ error: 'User not found in organization' }, { status: 404 })
  }

  if (targetMembership.role === 'owner') {
    return NextResponse.json({ error: 'Cannot change the owner\'s role' }, { status: 403 })
  }

  const { error } = await adminSupabase
    .from('memberships')
    .update({ role: newRole })
    .eq('user_id', targetUserId)
    .eq('org_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, role: newRole })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await authenticateRequest(request)
  if (isErrorResponse(auth)) return auth
  const { orgId, role: callerRole } = auth

  // Only owners can remove members
  if (callerRole !== 'owner') {
    return NextResponse.json({ error: 'Only owners can remove members' }, { status: 403 })
  }

  const { userId: targetUserId } = await params
  const adminSupabase = createAdminClient()

  // Can't remove the owner
  const { data: targetMembership } = await adminSupabase
    .from('memberships')
    .select('role')
    .eq('user_id', targetUserId)
    .eq('org_id', orgId)
    .single()

  if (!targetMembership) {
    return NextResponse.json({ error: 'User not found in organization' }, { status: 404 })
  }

  if (targetMembership.role === 'owner') {
    return NextResponse.json({ error: 'Cannot remove the owner' }, { status: 403 })
  }

  const { error } = await adminSupabase
    .from('memberships')
    .delete()
    .eq('user_id', targetUserId)
    .eq('org_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
