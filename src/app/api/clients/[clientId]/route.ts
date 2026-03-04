import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, isErrorResponse } from '@/lib/api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const auth = await authenticateRequest(request)
  if (isErrorResponse(auth)) return auth
  const { supabase } = auth

  const { clientId } = await params

  const { data, error } = await supabase
    .from('clients')
    .select(`
      *,
      contacts(*),
      projects(id, name, status, priority, due_date),
      notes(id, content, pinned, author_id, created_at),
      activities(id, activity_type, title, description, created_at, actor_id)
    `)
    .eq('id', clientId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  return NextResponse.json({ data })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const auth = await authenticateRequest(request, 'update')
  if (isErrorResponse(auth)) return auth
  const { user, supabase, orgId } = auth

  const { clientId } = await params
  const body = await request.json()

  const { data, error } = await supabase
    .from('clients')
    .update(body)
    .eq('id', clientId)
    .eq('org_id', orgId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activities').insert({
    org_id: orgId,
    client_id: clientId,
    actor_id: user.id,
    activity_type: 'client_updated',
    title: `Updated client ${data.company_name}`,
  })

  return NextResponse.json({ data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const auth = await authenticateRequest(request, 'delete')
  if (isErrorResponse(auth)) return auth
  const { supabase, orgId } = auth

  const { clientId } = await params

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId)
    .eq('org_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
