import { createAdminClient } from '@/lib/supabase/admin'

async function getOrgApiKey(orgId: string): Promise<string> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('integration_credentials')
    .select('api_key')
    .eq('org_id', orgId)
    .eq('provider', 'semrush')
    .eq('is_active', true)
    .single()

  if (!data?.api_key) throw new Error('SEMRush not connected for this organization')
  return data.api_key
}

function parseSemrushCSV(csv: string): Record<string, string>[] {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(';')
  return lines.slice(1).map((line) => {
    const values = line.split(';')
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    return row
  })
}

const SEMRUSH_BASE = 'https://api.semrush.com/'

export async function getDomainOverview(orgId: string, domain: string, database = 'us') {
  const apiKey = await getOrgApiKey(orgId)
  const params = new URLSearchParams({
    type: 'domain_ranks',
    key: apiKey,
    export_columns: 'Db,Dn,Rk,Or,Ot,Oc,Ad,At,Ac',
    domain,
    database,
  })

  const response = await fetch(`${SEMRUSH_BASE}?${params}`)
  if (!response.ok) throw new Error(`SEMRush API error: ${response.status}`)
  const text = await response.text()
  return parseSemrushCSV(text)
}

export async function getDomainOrganicKeywords(orgId: string, domain: string, limit = 20, database = 'us') {
  const apiKey = await getOrgApiKey(orgId)
  const params = new URLSearchParams({
    type: 'domain_organic',
    key: apiKey,
    export_columns: 'Ph,Po,Nq,Cp,Ur,Tr,Tc,Co,Nr,Td',
    domain,
    database,
    display_limit: String(limit),
  })

  const response = await fetch(`${SEMRUSH_BASE}?${params}`)
  if (!response.ok) throw new Error(`SEMRush API error: ${response.status}`)
  const text = await response.text()
  return parseSemrushCSV(text)
}
