import { streamText, stepCountIs, convertToModelMessages } from 'ai'
import { getAiModel } from '@/lib/ai/get-model'
import { getCrmTools } from '@/lib/gemini/tools'
import { getSystemPrompt } from '@/lib/gemini/system-prompt'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Role } from '@/lib/permissions'

export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { messages } = await request.json()

  // Get orgId from header, or fall back to user's default org
  let orgId = request.headers.get('x-org-id')
  if (!orgId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('default_org_id')
      .eq('id', user.id)
      .single()
    orgId = profile?.default_org_id ?? null
  }
  if (!orgId) {
    // Last resort: get first membership
    const { data: membership } = await supabase
      .from('memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()
    orgId = membership?.org_id ?? null
  }
  if (!orgId) return new Response('No org context', { status: 400 })

  // Get user's role in this org
  const adminSupabase = createAdminClient()
  const { data: membership } = await adminSupabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('org_id', orgId)
    .single()

  const role = (membership?.role as Role) || 'member'

  try {
    const model = await getAiModel(orgId)
    const result = streamText({
      model,
      system: getSystemPrompt(orgId, role),
      messages: await convertToModelMessages(messages),
      tools: getCrmTools(orgId, user.id, role),
      stopWhen: stepCountIs(10),
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error('Chat API error:', error)
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
  }
}
