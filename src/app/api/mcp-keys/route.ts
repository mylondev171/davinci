import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, isErrorResponse } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

// GET — list all API keys for the org (metadata only, never the raw key)
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (isErrorResponse(auth)) return auth
  const { orgId } = auth

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('mcp_api_keys')
    .select('id, name, created_at, last_used_at, is_active')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

// POST — generate a new API key; returns the raw key once (never stored)
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request, 'create')
  if (isErrorResponse(auth)) return auth
  const { user, orgId } = auth

  const body = await request.json().catch(() => ({}))
  const name = (body.name as string) || 'Coworker AI'

  // Generate a cryptographically random key with a recognisable prefix
  const rawKey = 'crm_' + crypto.randomBytes(32).toString('hex')
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('mcp_api_keys')
    .insert({ org_id: orgId, key_hash: keyHash, name, created_by: user.id })
    .select('id, name, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return the raw key here — this is the only time it will ever be shown
  return NextResponse.json({ data: { ...data, key: rawKey } }, { status: 201 })
}
