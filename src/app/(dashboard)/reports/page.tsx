'use client'

import { useEffect, useState, useCallback } from 'react'
import { useApi } from '@/lib/hooks/use-api'
import { useOrg } from '@/providers/org-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { BarChart3, Globe, TrendingUp, Search, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

type Client = { id: string; company_name: string; website: string | null }

type DomainRow = Record<string, string>

type KeywordRow = {
  Ph: string   // Phrase
  Po: string   // Position
  Nq: string   // Search volume
  Cp: string   // CPC
  Tr: string   // Traffic %
  Co: string   // Competition
  Ur: string   // URL
}

// Friendly label map for domain overview fields
const DOMAIN_LABELS: Record<string, string> = {
  Db: 'Database',
  Dn: 'Domain',
  Rk: 'SEMRush Rank',
  Or: 'Organic Keywords',
  Ot: 'Organic Traffic',
  Oc: 'Organic Traffic Cost',
  Ad: 'Paid Keywords',
  At: 'Paid Traffic',
  Ac: 'Paid Traffic Cost',
}

export default function ReportsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [selectedClientId, setSelectedClientId] = useState<string>('none')
  const [domain, setDomain] = useState('')
  const [domainData, setDomainData] = useState<DomainRow | null>(null)
  const [keywords, setKeywords] = useState<KeywordRow[]>([])
  const [fetchingDomain, setFetchingDomain] = useState(false)
  const [fetchingKeywords, setFetchingKeywords] = useState(false)
  const [semrushError, setSemrushError] = useState<string | null>(null)
  const { apiFetch } = useApi()
  const { currentOrg } = useOrg()

  const fetchClients = useCallback(async () => {
    if (!currentOrg) return
    try {
      const { data } = await apiFetch('/api/clients?limit=200')
      setClients(data || [])
    } catch {
      // Silently fail — client selector just won't populate
    } finally {
      setClientsLoading(false)
    }
  }, [apiFetch, currentOrg])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  // Pre-fill domain when a client is selected
  useEffect(() => {
    if (selectedClientId === 'none') return
    const client = clients.find((c) => c.id === selectedClientId)
    if (client?.website) {
      try {
        const url = new URL(
          client.website.startsWith('http') ? client.website : `https://${client.website}`
        )
        setDomain(url.hostname.replace(/^www\./, ''))
      } catch {
        setDomain(client.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0])
      }
    }
  }, [selectedClientId, clients])

  const handleFetchReport = async () => {
    if (!domain.trim()) {
      toast.error('Please enter a domain')
      return
    }
    setSemrushError(null)
    setDomainData(null)
    setKeywords([])
    setFetchingDomain(true)
    setFetchingKeywords(true)

    const cleanDomain = domain.trim().replace(/^https?:\/\/(www\.)?/, '').split('/')[0]

    // Fetch domain overview
    try {
      const { data, error } = await apiFetch(`/api/semrush/domain?domain=${encodeURIComponent(cleanDomain)}`)
      if (error) {
        setSemrushError(error)
        setFetchingKeywords(false)
        return
      }
      if (data && data.length > 0) {
        setDomainData(data[0])
      } else {
        setSemrushError('No data found for this domain. It may not be indexed by SEMRush.')
        setFetchingKeywords(false)
        return
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch domain report'
      setSemrushError(msg)
      setFetchingKeywords(false)
      return
    } finally {
      setFetchingDomain(false)
    }

    // Fetch top keywords
    try {
      const { data: kwData, error: kwError } = await apiFetch(
        `/api/semrush/keywords?domain=${encodeURIComponent(cleanDomain)}&limit=20`
      )
      if (!kwError && kwData) {
        setKeywords(kwData)
      }
    } catch {
      // Keywords are best-effort; domain data already shown
    } finally {
      setFetchingKeywords(false)
    }
  }

  const isNotConnectedError =
    semrushError?.toLowerCase().includes('not connected') ||
    semrushError?.toLowerCase().includes('semrush not connected')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-muted-foreground">SEO analytics and marketing performance via SEMRush</p>
      </div>

      {/* Controls */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Domain Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Client picker */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Client (optional)</label>
              {clientsLoading ? (
                <div className="w-52 h-9 rounded-md border border-border animate-pulse bg-muted" />
              ) : (
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="Select a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No client selected</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Domain input */}
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">Domain</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="e.g. example.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="pl-9"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleFetchReport() }}
                />
              </div>
            </div>

            <Button
              onClick={handleFetchReport}
              disabled={fetchingDomain || fetchingKeywords || !domain.trim()}
              className="shrink-0"
            >
              {fetchingDomain ? 'Fetching...' : 'Fetch Domain Report'}
            </Button>
          </div>

          {/* Error state */}
          {semrushError && (
            <div className="flex items-start gap-3 rounded-lg border border-red-400/30 bg-red-400/5 p-4">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm text-red-400 font-medium">
                  {isNotConnectedError ? 'SEMRush not connected' : 'Error'}
                </p>
                <p className="text-sm text-muted-foreground">{semrushError}</p>
                {isNotConnectedError && (
                  <p className="text-xs text-muted-foreground">
                    Go to <strong>Settings &gt; Integrations</strong> to connect your SEMRush API key.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Domain overview results */}
      {(fetchingDomain || domainData) && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Domain Overview
              {domainData?.Dn && (
                <span className="text-sm font-normal text-muted-foreground ml-1">— {domainData.Dn}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {fetchingDomain ? (
              <LoadingSpinner />
            ) : domainData ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.entries(domainData)
                  .filter(([key]) => key !== 'Db' && key !== 'Dn')
                  .map(([key, value]) => (
                    <div key={key} className="rounded-lg border border-border p-3 space-y-1">
                      <p className="text-xs text-muted-foreground">{DOMAIN_LABELS[key] || key}</p>
                      <p className="text-lg font-semibold text-foreground">
                        {value ? Number(value).toLocaleString() : '—'}
                      </p>
                    </div>
                  ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Top keywords results */}
      {(fetchingKeywords || keywords.length > 0) && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Top Organic Keywords
            </CardTitle>
          </CardHeader>
          <CardContent>
            {fetchingKeywords ? (
              <LoadingSpinner />
            ) : keywords.length > 0 ? (
              <div className="rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Keyword</TableHead>
                      <TableHead className="text-muted-foreground text-right">Position</TableHead>
                      <TableHead className="text-muted-foreground text-right">Volume</TableHead>
                      <TableHead className="text-muted-foreground text-right">CPC ($)</TableHead>
                      <TableHead className="text-muted-foreground text-right">Traffic %</TableHead>
                      <TableHead className="text-muted-foreground text-right">Competition</TableHead>
                      <TableHead className="text-muted-foreground">URL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keywords.map((kw, i) => (
                      <TableRow key={i} className="border-border hover:bg-accent/50">
                        <TableCell className="font-medium text-foreground">{kw.Ph}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{kw.Po}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {kw.Nq ? Number(kw.Nq).toLocaleString() : '—'}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {kw.Cp ? `$${Number(kw.Cp).toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{kw.Tr ? `${kw.Tr}%` : '—'}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{kw.Co || '—'}</TableCell>
                        <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate" title={kw.Ur}>
                          {kw.Ur || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
