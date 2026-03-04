import { NextRequest, NextResponse } from 'next/server'
import { createOAuth2Client } from '@/lib/google/auth'
import { GOOGLE_SCOPES } from '@/lib/google/scopes'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = request.nextUrl.searchParams.get('orgId')
  if (!orgId) return NextResponse.json({ error: 'Missing orgId' }, { status: 400 })

  const oauth2Client = createOAuth2Client()
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_SCOPES,
    prompt: 'consent',
    state: JSON.stringify({ orgId, userId: user.id }),
  })

  return NextResponse.redirect(authUrl)
}
