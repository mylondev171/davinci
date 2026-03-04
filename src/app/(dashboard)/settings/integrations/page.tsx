'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useOrg } from '@/providers/org-provider'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, XCircle, ExternalLink } from 'lucide-react'

interface Integration {
  provider: string
  is_active: boolean
  account_email?: string
  user_id?: string | null
  last_synced_at?: string
}

export default function IntegrationsPage() {
  return (
    <Suspense>
      <IntegrationsContent />
    </Suspense>
  )
}

function IntegrationsContent() {
  const { currentOrg } = useOrg()
  const { isOwner, can } = usePermissions()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [myGoogleConnected, setMyGoogleConnected] = useState<Integration | null>(null)
  const [semrushKey, setSemrushKey] = useState('')
  const [reportGardenSheetId, setReportGardenSheetId] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    if (success === 'google') toast.success('Google account connected successfully!')
    if (error) toast.error(`Connection failed: ${error}`)
  }, [searchParams])

  const fetchIntegrations = useCallback(async () => {
    if (!currentOrg) return

    // Fetch org-wide integrations (semrush, reportgarden)
    const { data: orgIntegrations } = await supabase
      .from('integration_credentials')
      .select('provider, is_active, account_email, user_id, last_synced_at')
      .eq('org_id', currentOrg.id)
      .is('user_id', null)
    setIntegrations(orgIntegrations || [])

    // Fetch current user's Google connection
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: googleCred } = await supabase
        .from('integration_credentials')
        .select('provider, is_active, account_email, user_id, last_synced_at')
        .eq('org_id', currentOrg.id)
        .eq('provider', 'google')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()
      setMyGoogleConnected(googleCred || null)
    }
  }, [currentOrg, supabase])

  useEffect(() => {
    fetchIntegrations()
  }, [fetchIntegrations])

  const isOrgConnected = (provider: string) =>
    integrations.find((i) => i.provider === provider && i.is_active)

  const handleConnectGoogle = () => {
    if (!currentOrg) return
    window.location.href = `/api/google/connect?orgId=${currentOrg.id}`
  }

  const handleSaveApiKey = async (provider: string, apiKey: string) => {
    if (!currentOrg || !apiKey.trim()) return
    setSaving(provider)
    try {
      const { error } = await supabase.from('integration_credentials').upsert(
        {
          org_id: currentOrg.id,
          provider,
          api_key: apiKey,
          is_active: true,
          connected_by: (await supabase.auth.getUser()).data.user?.id,
        },
        { onConflict: 'org_id,provider' }
      )
      if (error) throw error
      toast.success(`${provider} connected!`)
      fetchIntegrations()
    } catch (error) {
      toast.error(`Failed to save ${provider} key`)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
        <p className="text-muted-foreground">Connect your accounts to enable data syncing</p>
      </div>

      <div className="grid gap-4">
        {/* Google — per-user */}
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="h-6 w-6">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                </div>
                <div>
                  <CardTitle className="text-foreground">Google Services</CardTitle>
                  <CardDescription>Gmail, Drive, Docs, Sheets (per-user)</CardDescription>
                </div>
              </div>
              {myGoogleConnected ? (
                <Badge variant="outline" className="border-green-500/20 text-green-400">
                  <CheckCircle className="mr-1 h-3 w-3" /> Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="border-border text-muted-foreground">
                  <XCircle className="mr-1 h-3 w-3" /> Not connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {myGoogleConnected ? (
              <p className="text-sm text-muted-foreground">
                Connected as {myGoogleConnected.account_email}
              </p>
            ) : (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Each user connects their own Google account. AI chat will only access your Google data.
                </p>
                <Button onClick={handleConnectGoogle}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Connect Google Account
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SEMRush — owner only */}
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold text-sm">
                  SE
                </div>
                <div>
                  <CardTitle className="text-foreground">SEMRush</CardTitle>
                  <CardDescription>SEO analytics and keyword tracking</CardDescription>
                </div>
              </div>
              {isOrgConnected('semrush') ? (
                <Badge variant="outline" className="border-green-500/20 text-green-400">
                  <CheckCircle className="mr-1 h-3 w-3" /> Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="border-border text-muted-foreground">
                  <XCircle className="mr-1 h-3 w-3" /> Not connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isOwner ? (
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="semrush-key" className="sr-only">API Key</Label>
                  <Input
                    id="semrush-key"
                    type="password"
                    placeholder="Enter SEMRush API key"
                    value={semrushKey}
                    onChange={(e) => setSemrushKey(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => handleSaveApiKey('semrush', semrushKey)}
                  disabled={saving === 'semrush' || !semrushKey.trim()}
                >
                  {saving === 'semrush' ? 'Saving...' : 'Save'}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {isOrgConnected('semrush')
                  ? 'SEMRush is configured for this organization.'
                  : 'Only the organization owner can configure SEMRush.'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ReportGarden — owner only */}
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-600 flex items-center justify-center text-white font-bold text-sm">
                  RG
                </div>
                <div>
                  <CardTitle className="text-foreground">ReportGarden</CardTitle>
                  <CardDescription>Marketing reports via Google Sheets export</CardDescription>
                </div>
              </div>
              {isOrgConnected('reportgarden') ? (
                <Badge variant="outline" className="border-green-500/20 text-green-400">
                  <CheckCircle className="mr-1 h-3 w-3" /> Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="border-border text-muted-foreground">
                  <XCircle className="mr-1 h-3 w-3" /> Not configured
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isOwner ? (
              <>
                <p className="text-xs text-muted-foreground mb-2">
                  Enter the Google Sheet ID where ReportGarden exports data.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Google Sheet ID"
                    value={reportGardenSheetId}
                    onChange={(e) => setReportGardenSheetId(e.target.value)}
                  />
                  <Button
                    onClick={() => handleSaveApiKey('reportgarden', reportGardenSheetId)}
                    disabled={saving === 'reportgarden' || !reportGardenSheetId.trim()}
                  >
                    {saving === 'reportgarden' ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {isOrgConnected('reportgarden')
                  ? 'ReportGarden is configured for this organization.'
                  : 'Only the organization owner can configure ReportGarden.'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
