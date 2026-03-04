import { google } from 'googleapis'
import { createAdminClient } from '@/lib/supabase/admin'

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`
  )
}

export async function getGoogleClient(orgId: string, userId: string) {
  const supabase = createAdminClient()

  const { data: creds } = await supabase
    .from('integration_credentials')
    .select('*')
    .eq('org_id', orgId)
    .eq('provider', 'google')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (!creds) {
    throw new Error('Google not connected for your account. Please connect your Google account in Settings > Integrations.')
  }

  const oauth2Client = createOAuth2Client()

  oauth2Client.setCredentials({
    access_token: creds.access_token,
    refresh_token: creds.refresh_token,
    expiry_date: creds.token_expires_at ? new Date(creds.token_expires_at).getTime() : undefined,
  })

  // Auto-refresh handler
  oauth2Client.on('tokens', async (tokens) => {
    const updates: Record<string, unknown> = {}
    if (tokens.access_token) updates.access_token = tokens.access_token
    if (tokens.expiry_date) updates.token_expires_at = new Date(tokens.expiry_date).toISOString()

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('integration_credentials')
        .update(updates)
        .eq('org_id', orgId)
        .eq('provider', 'google')
        .eq('user_id', userId)
    }
  })

  return oauth2Client
}
