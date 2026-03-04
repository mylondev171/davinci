import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasPermission, type Permission, type Role } from '@/lib/permissions'
import type { SupabaseClient, User } from '@supabase/supabase-js'

type AuthSuccess = {
  user: User
  orgId: string
  role: Role
  supabase: SupabaseClient
}

type AuthResult = AuthSuccess | NextResponse

export function isErrorResponse(result: AuthResult): result is NextResponse {
  return result instanceof NextResponse
}

export async function authenticateRequest(
  request: Request,
  requiredPermission?: Permission
): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = request.headers.get('x-org-id')
  if (!orgId) {
    return NextResponse.json({ error: 'No org context' }, { status: 400 })
  }

  // Get the user's role in this org
  const adminSupabase = createAdminClient()
  const { data: membership } = await adminSupabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('org_id', orgId)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 })
  }

  const role = membership.role as Role

  if (requiredPermission && !hasPermission(role, requiredPermission)) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    )
  }

  return { user, orgId, role, supabase }
}
