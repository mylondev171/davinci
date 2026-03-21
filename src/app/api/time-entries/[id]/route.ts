import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, isErrorResponse } from '@/lib/api-auth'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await authenticateRequest(request, 'update')
  if (isErrorResponse(auth)) return auth
  const { supabase, orgId } = auth
  const { id } = await params
  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if (body.hours !== undefined) updates.hours = body.hours
  if (body.date !== undefined) updates.date = body.date
  if (body.note !== undefined) updates.note = body.note || null
  if (body.billable !== undefined) updates.billable = body.billable

  const { data, error } = await supabase
    .from('time_entries').update(updates).eq('id', id).eq('org_id', orgId)
    .select('*, tasks(id, title), projects(id, name), profiles:user_id(id, full_name, avatar_url)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await authenticateRequest(request, 'delete')
  if (isErrorResponse(auth)) return auth
  const { supabase, orgId } = auth
  const { id } = await params
  const { error } = await supabase.from('time_entries').delete().eq('id', id).eq('org_id', orgId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
