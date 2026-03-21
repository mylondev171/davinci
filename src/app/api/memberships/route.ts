import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, isErrorResponse } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (isErrorResponse(auth)) return auth
  const { supabase, orgId } = auth

  const { data, error } = await supabase
    .from('memberships')
    .select('user_id, role, profiles:user_id(id, full_name, avatar_url)')
    .eq('org_id', orgId)
    .order('role')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
