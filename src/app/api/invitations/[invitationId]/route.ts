import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, isErrorResponse } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  const auth = await authenticateRequest(request, 'invite')
  if (isErrorResponse(auth)) return auth
  const { orgId } = auth

  const { invitationId } = await params
  const adminSupabase = createAdminClient()

  const { error } = await adminSupabase
    .from('org_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId)
    .eq('org_id', orgId)
    .eq('status', 'pending')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
