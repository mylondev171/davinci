import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid_invite', request.url))
  }

  // Check if user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Redirect to login with a next param to come back
    const acceptUrl = `/api/invitations/accept?token=${token}`
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(acceptUrl)}`, request.url))
  }

  const adminSupabase = createAdminClient()

  // Find the invitation
  const { data: invitation, error } = await adminSupabase
    .from('org_invitations')
    .select('*')
    .eq('token', token)
    .eq('status', 'pending')
    .single()

  if (error || !invitation) {
    return NextResponse.redirect(new URL('/dashboard?error=invite_invalid', request.url))
  }

  // Check if expired
  if (new Date(invitation.expires_at) < new Date()) {
    await adminSupabase
      .from('org_invitations')
      .update({ status: 'expired' })
      .eq('id', invitation.id)

    return NextResponse.redirect(new URL('/dashboard?error=invite_expired', request.url))
  }

  // Check if already a member
  const { data: existingMembership } = await adminSupabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('org_id', invitation.org_id)
    .single()

  if (existingMembership) {
    // Already a member, just mark invite as accepted
    await adminSupabase
      .from('org_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)

    return NextResponse.redirect(new URL('/dashboard?info=already_member', request.url))
  }

  // Create membership
  const { error: membershipError } = await adminSupabase
    .from('memberships')
    .insert({
      user_id: user.id,
      org_id: invitation.org_id,
      role: invitation.role,
    })

  if (membershipError) {
    console.error('Failed to create membership:', membershipError)
    return NextResponse.redirect(new URL('/dashboard?error=join_failed', request.url))
  }

  // Mark invitation as accepted
  await adminSupabase
    .from('org_invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)

  return NextResponse.redirect(new URL('/dashboard?success=joined', request.url))
}
