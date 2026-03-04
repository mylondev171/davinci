import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, isErrorResponse } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request, 'invite')
  if (isErrorResponse(auth)) return auth
  const { orgId } = auth

  const adminSupabase = createAdminClient()
  const { data, error } = await adminSupabase
    .from('org_invitations')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, 'invite')
  if (isErrorResponse(auth)) return auth
  const { user, orgId, role } = auth

  const { email, role: inviteRole = 'member' } = await request.json()

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  // Only owners can invite as admin
  if (inviteRole === 'admin' && role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can invite admins' }, { status: 403 })
  }

  const adminSupabase = createAdminClient()

  // Check if user is already a member
  const { data: existingMember } = await adminSupabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (existingMember) {
    const { data: membership } = await adminSupabase
      .from('memberships')
      .select('id')
      .eq('user_id', existingMember.id)
      .eq('org_id', orgId)
      .single()

    if (membership) {
      return NextResponse.json({ error: 'User is already a member of this organization' }, { status: 409 })
    }
  }

  // Check for existing pending invitation
  const { data: existingInvite } = await adminSupabase
    .from('org_invitations')
    .select('id')
    .eq('org_id', orgId)
    .eq('email', email)
    .eq('status', 'pending')
    .single()

  if (existingInvite) {
    return NextResponse.json({ error: 'An invitation is already pending for this email' }, { status: 409 })
  }

  // Create the invitation
  const { data: invitation, error } = await adminSupabase
    .from('org_invitations')
    .insert({
      org_id: orgId,
      email,
      role: inviteRole,
      invited_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Build invite link
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || ''
  const inviteLink = `${baseUrl}/api/invitations/accept?token=${invitation.token}`

  // Fire-and-forget: send email via Supabase Edge Function without blocking the response
  // If the edge function is undeployed or slow, the invite still succeeds with a copy-link fallback
  Promise.all([
    adminSupabase.from('organizations').select('name').eq('id', orgId).single(),
    adminSupabase.from('profiles').select('full_name').eq('id', user.id).single(),
  ]).then(([{ data: org }, { data: inviterProfile }]) => {
    adminSupabase.functions.invoke('send-invite-email', {
      body: {
        to: email,
        orgName: org?.name || 'the organization',
        inviterName: inviterProfile?.full_name || 'A team member',
        role: inviteRole,
        inviteLink,
      },
    }).catch(() => { /* Edge function not deployed or failed — silent fallback */ })
  }).catch(() => { /* Failed to fetch org/profile info — silent fallback */ })

  return NextResponse.json({
    data: invitation,
    inviteLink,
    emailSent: false, // Email is sent async; UI should use the copy-link fallback
  }, { status: 201 })
}
