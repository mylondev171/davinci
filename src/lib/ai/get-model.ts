import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAdminClient } from '@/lib/supabase/admin'

export async function getAiModel(orgId: string) {
  const supabase = createAdminClient()

  const { data: credentials } = await supabase
    .from('integration_credentials')
    .select('provider, api_key')
    .eq('org_id', orgId)
    .is('user_id', null)
    .eq('is_active', true)
    .in('provider', ['claude', 'gemini'])

  const claudeCred = credentials?.find((c) => c.provider === 'claude')
  if (claudeCred?.api_key) {
    const anthropic = createAnthropic({ apiKey: claudeCred.api_key })
    return anthropic('claude-sonnet-4-6')
  }

  const geminiCred = credentials?.find((c) => c.provider === 'gemini')
  if (geminiCred?.api_key) {
    const googleAI = createGoogleGenerativeAI({ apiKey: geminiCred.api_key })
    return googleAI('gemini-2.5-flash')
  }

  // Fallback to env var
  const googleAI = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '',
  })
  return googleAI('gemini-2.5-flash')
}
