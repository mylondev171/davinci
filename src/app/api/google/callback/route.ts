import { NextRequest, NextResponse } from 'next/server'
import { createOAuth2Client } from '@/lib/google/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const code = request.nextUrl.searchParams.get('code')
  const stateParam = request.nextUrl.searchParams.get('state')

  if (!code || !stateParam) {
    return NextResponse.redirect(new URL('/settings/integrations?error=missing_params', request.url))
  }

  let orgId: string
  let userId: string
  try {
    const state = JSON.parse(stateParam)
    orgId = state.orgId
    userId = state.userId
  } catch {
    // Fallback for legacy state format (just orgId string)
    orgId = stateParam
    userId = user.id
  }

  try {
    const oauth2Client = createOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)

    // Get the Google account email
    oauth2Client.setCredentials(tokens)
    const oauth2 = await import('googleapis').then(g => g.google.oauth2({ version: 'v2', auth: oauth2Client }))
    const { data: userInfo } = await oauth2.userinfo.get()

    // Store tokens using admin client (bypasses RLS)
    const adminSupabase = createAdminClient()

    // Check if this user already has a Google credential for this org
    const { data: existing } = await adminSupabase
      .from('integration_credentials')
      .select('id')
      .eq('org_id', orgId)
      .eq('provider', 'google')
      .eq('user_id', userId)
      .single()

    if (existing) {
      // Update existing credential
      await adminSupabase
        .from('integration_credentials')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          scopes: tokens.scope?.split(' ') || [],
          account_email: userInfo.email,
          connected_by: user.id,
          is_active: true,
        })
        .eq('id', existing.id)
    } else {
      // Insert new credential
      await adminSupabase
        .from('integration_credentials')
        .insert({
          org_id: orgId,
          provider: 'google',
          user_id: userId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          scopes: tokens.scope?.split(' ') || [],
          account_email: userInfo.email,
          connected_by: user.id,
          is_active: true,
        })
    }

    return NextResponse.redirect(new URL('/settings/integrations?success=google', request.url))
  } catch (error) {
    console.error('Google OAuth error:', error)
    return NextResponse.redirect(new URL('/settings/integrations?error=google_auth_failed', request.url))
  }
}
