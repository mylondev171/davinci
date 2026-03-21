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
  const { isOwner, isAdmin, can } = usePermissions()
  const canManage = isOwner || isAdmin
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [myGoogleConnected, setMyGoogleConnected] = useState<Integration | null>(null)
  const [semrushKey, setSemrushKey] = useState('')
  const [reportGardenSheetId, setReportGardenSheetId] = useState('')
  const [claudeKey, setClaudeKey] = useState('')
  const [geminiKey, setGeminiKey] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    if (success === 'google') toast.success('Google account connected successfully!')
    if (error) toast.error(`Connection failed: ${error}`)
  }, [searchParams])

  const fetchIntegrations = useCallback(async () => {
    if (!currentOrg) return

    // Fetch org-wide integrations
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

  const handleDisconnect = async (provider: string) => {
    if (!currentOrg) return
    setSaving(provider)
    try {
      const { data: existing } = await supabase
        .from('integration_credentials')
        .select('id')
        .eq('org_id', currentOrg.id)
        .eq('provider', provider)
        .is('user_id', null)
        .single()

      if (existing) {
        const { error } = await supabase
          .from('integration_credentials')
          .update({ is_active: false, api_key: null })
          .eq('id', existing.id)
        if (error) throw error
      }
      toast.success(`${provider} disconnected`)
      if (provider === 'claude') setClaudeKey('')
      if (provider === 'gemini') setGeminiKey('')
      fetchIntegrations()
    } catch {
      toast.error(`Failed to disconnect ${provider}`)
    } finally {
      setSaving(null)
    }
  }

  const handleSaveApiKey = async (provider: string, apiKey: string) => {
    if (!currentOrg || !apiKey.trim()) return
    setSaving(provider)
    try {
      const connectedBy = (await supabase.auth.getUser()).data.user?.id

      const { data: existing } = await supabase
        .from('integration_credentials')
        .select('id')
        .eq('org_id', currentOrg.id)
        .eq('provider', provider)
        .is('user_id', null)
        .single()

      const { error } = existing
        ? await supabase
            .from('integration_credentials')
            .update({ api_key: apiKey, is_active: true, connected_by: connectedBy })
            .eq('id', existing.id)
        : await supabase
            .from('integration_credentials')
            .insert({ org_id: currentOrg.id, provider, api_key: apiKey, is_active: true, connected_by: connectedBy })

      if (error) throw error
      toast.success(`${provider} connected!`)
      fetchIntegrations()
    } catch {
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

        {/* AI Providers */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">AI Provider</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Claude is used when available. Falls back to Gemini, then the server default.
          </p>
          <div className="grid gap-3">

            {/* Claude */}
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-[#D97757] flex items-center justify-center text-white font-bold text-sm">
                      C
                    </div>
                    <div>
                      <CardTitle className="text-foreground">Claude (Anthropic)</CardTitle>
                      <CardDescription>claude-sonnet-4-6 · Prioritized when key is set</CardDescription>
                    </div>
                  </div>
                  {isOrgConnected('claude') ? (
                    <Badge variant="outline" className="border-green-500/20 text-green-400">
                      <CheckCircle className="mr-1 h-3 w-3" /> Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-border text-muted-foreground">
                      <XCircle className="mr-1 h-3 w-3" /> Not configured
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {canManage ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Get your API key at <span className="font-mono">console.anthropic.com</span> → API Keys. Starts with <span className="font-mono">sk-ant-...</span>
                    </p>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label htmlFor="claude-key" className="sr-only">Anthropic API Key</Label>
                        <Input
                          id="claude-key"
                          type="password"
                          placeholder="sk-ant-..."
                          value={claudeKey}
                          onChange={(e) => setClaudeKey(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={() => handleSaveApiKey('claude', claudeKey)}
                        disabled={saving === 'claude' || !claudeKey.trim()}
                      >
                        {saving === 'claude' ? 'Saving...' : 'Save'}
                      </Button>
                      {isOrgConnected('claude') && (
                        <Button
                          variant="destructive"
                          onClick={() => handleDisconnect('claude')}
                          disabled={saving === 'claude'}
                        >
                          Disconnect
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {isOrgConnected('claude')
                      ? 'Claude is configured for this organization.'
                      : 'Only admins can configure the AI provider.'}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Gemini */}
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                      G
                    </div>
                    <div>
                      <CardTitle className="text-foreground">Gemini (Google)</CardTitle>
                      <CardDescription>gemini-2.5-flash · Used when Claude is not configured</CardDescription>
                    </div>
                  </div>
                  {isOrgConnected('gemini') ? (
                    <Badge variant="outline" className="border-green-500/20 text-green-400">
                      <CheckCircle className="mr-1 h-3 w-3" /> Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-border text-muted-foreground">
                      <XCircle className="mr-1 h-3 w-3" /> Using server default
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {canManage ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Get your API key at <span className="font-mono">aistudio.google.com</span>. Leave blank to use the server default key.
                    </p>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label htmlFor="gemini-key" className="sr-only">Gemini API Key</Label>
                        <Input
                          id="gemini-key"
                          type="password"
                          placeholder="AIza..."
                          value={geminiKey}
                          onChange={(e) => setGeminiKey(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={() => handleSaveApiKey('gemini', geminiKey)}
                        disabled={saving === 'gemini' || !geminiKey.trim()}
                      >
                        {saving === 'gemini' ? 'Saving...' : 'Save'}
                      </Button>
                      {isOrgConnected('gemini') && (
                        <Button
                          variant="destructive"
                          onClick={() => handleDisconnect('gemini')}
                          disabled={saving === 'gemini'}
                        >
                          Disconnect
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {isOrgConnected('gemini')
                      ? 'A custom Gemini key is configured for this organization.'
                      : 'Using server default Gemini key. Only admins can override.'}
                  </p>
                )}
              </CardContent>
            </Card>

          </div>
        </div>

        {/* Google — per-user */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Google Workspace</h2>
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
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Connected as {myGoogleConnected.account_email}
                  </p>
                  <Button variant="outline" size="sm" onClick={handleConnectGoogle}>
                    Refresh Access
                  </Button>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Each user connects their own Google account. The AI assistant will read your Gmail, Drive, Docs, and Sheets.
                  </p>
                  <Button onClick={handleConnectGoogle}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Connect Google Account
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* SEMRush + ReportGarden */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Analytics</h2>
          <div className="grid gap-3">

            {/* SEMRush */}
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
                {canManage ? (
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
                      : 'Only admins can configure SEMRush.'}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* ReportGarden */}
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
                {canManage ? (
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
                      : 'Only admins can configure ReportGarden.'}
                  </p>
                )}
              </CardContent>
            </Card>

          </div>
        </div>

      </div>
    </div>
  )
}
