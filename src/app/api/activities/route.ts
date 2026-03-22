import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, isErrorResponse } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (isErrorResponse(auth)) return auth
  const { supabase, orgId } = auth

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')
  const projectId = searchParams.get('project_id')
  const limit = parseInt(searchParams.get('limit') || '30')

  let query = supabase
    .from('activities')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (clientId) query = query.eq('client_id', clientId)
  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch actor profiles separately (no FK from actor_id to profiles)
  const actorIds = [...new Set(data?.map((a) => a.actor_id).filter(Boolean))] as string[]
  let profilesMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {}
  if (actorIds.length > 0) {
    const adminSupabase = createAdminClient()
    const { data: profiles } = await adminSupabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', actorIds)
    if (profiles) {
      profilesMap = Object.fromEntries(profiles.map((p) => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]))
    }
  }

  const dataWithProfiles = data?.map((a) => ({
    ...a,
    profiles: a.actor_id ? profilesMap[a.actor_id] || null : null,
  }))

  return NextResponse.json({ data: dataWithProfiles })
}
