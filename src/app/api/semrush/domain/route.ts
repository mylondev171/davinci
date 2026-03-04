import { createClient } from '@/lib/supabase/server'
import { getDomainOverview } from '@/lib/semrush/client'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = request.headers.get('x-org-id')
  if (!orgId) return NextResponse.json({ error: 'No org context' }, { status: 400 })

  const domain = request.nextUrl.searchParams.get('domain')
  const database = request.nextUrl.searchParams.get('database') || 'us'
  if (!domain) return NextResponse.json({ error: 'Missing domain' }, { status: 400 })

  try {
    const data = await getDomainOverview(orgId, domain, database)
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'SEMRush error' },
      { status: 500 }
    )
  }
}
