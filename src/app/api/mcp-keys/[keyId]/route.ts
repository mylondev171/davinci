import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, isErrorResponse } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

type RouteContext = { params: Promise<{ keyId: string }> }

// DELETE — revoke an API key
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(request, 'delete')
  if (isErrorResponse(auth)) return auth
  const { orgId } = auth

  const { keyId } = await context.params
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('mcp_api_keys')
    .update({ is_active: false })
    .eq('id', keyId)
    .eq('org_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
