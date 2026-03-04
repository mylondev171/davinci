'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useApi } from '@/lib/hooks/use-api'
import { useOrg } from '@/providers/org-provider'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { EmptyState } from '@/components/shared/empty-state'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, KeyRound, Eye, EyeOff, Copy, ExternalLink, ArrowUpDown, Trash2, Edit } from 'lucide-react'
import { toast } from 'sonner'
import { CredentialForm } from '@/components/clients/credential-form'
import Link from 'next/link'

interface Credential {
  id: string
  org_id: string
  client_id: string
  created_by: string
  platform_name: string
  platform_url: string | null
  username: string
  poc: string | null
  scope: 'organization' | 'personal'
  created_at: string
  updated_at: string
  clients: { company_name: string } | null
}

type SortField = 'platform_name' | 'client' | 'username' | 'scope' | 'created_at'
type SortDir = 'asc' | 'desc'

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [scopeFilter, setScopeFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('platform_name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({})
  const [revealingId, setRevealingId] = useState<string | null>(null)
  const { apiFetch } = useApi()
  const { currentOrg } = useOrg()
  const { can } = usePermissions()

  const fetchCredentials = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const { data } = await apiFetch(`/api/client-credentials?${params}`)
      setCredentials(data || [])
    } catch {
      toast.error('Failed to load credentials')
    } finally {
      setLoading(false)
    }
  }, [apiFetch, search])

  useEffect(() => {
    if (currentOrg) fetchCredentials()
  }, [fetchCredentials, currentOrg])

  const handleRevealPassword = async (credentialId: string) => {
    if (revealedPasswords[credentialId]) {
      setRevealedPasswords((prev) => {
        const next = { ...prev }
        delete next[credentialId]
        return next
      })
      return
    }
    setRevealingId(credentialId)
    try {
      const { data } = await apiFetch(`/api/client-credentials/${credentialId}`)
      setRevealedPasswords((prev) => ({ ...prev, [credentialId]: data.encrypted_password }))
    } catch {
      toast.error('Failed to reveal password')
    } finally {
      setRevealingId(null)
    }
  }

  const handleDelete = async (credentialId: string) => {
    try {
      await apiFetch(`/api/client-credentials/${credentialId}`, { method: 'DELETE' })
      fetchCredentials()
      toast.success('Credential deleted')
    } catch {
      toast.error('Failed to delete credential')
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    let items = credentials
    if (scopeFilter !== 'all') {
      items = items.filter((c) => c.scope === scopeFilter)
    }
    // Sort
    return [...items].sort((a, b) => {
      let aVal: string
      let bVal: string
      switch (sortField) {
        case 'platform_name':
          aVal = a.platform_name.toLowerCase()
          bVal = b.platform_name.toLowerCase()
          break
        case 'client':
          aVal = (a.clients?.company_name || '').toLowerCase()
          bVal = (b.clients?.company_name || '').toLowerCase()
          break
        case 'username':
          aVal = a.username.toLowerCase()
          bVal = b.username.toLowerCase()
          break
        case 'scope':
          aVal = a.scope
          bVal = b.scope
          break
        case 'created_at':
          aVal = a.created_at
          bVal = b.created_at
          break
        default:
          return 0
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [credentials, scopeFilter, sortField, sortDir])

  // Get unique client names for context
  const clientCount = useMemo(() => {
    return new Set(credentials.map((c) => c.client_id)).size
  }, [credentials])

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-foreground' : 'text-muted-foreground/50'}`} />
      </div>
    </TableHead>
  )

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Credentials</h1>
          <p className="text-muted-foreground">
            {credentials.length} credential{credentials.length !== 1 ? 's' : ''} across {clientCount} client{clientCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by platform, username, or POC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={scopeFilter} onValueChange={setScopeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All visibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Visibility</SelectItem>
            <SelectItem value="organization">Organization</SelectItem>
            <SelectItem value="personal">Personal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No credentials found"
          description={search || scopeFilter !== 'all' ? 'Try adjusting your search or filters.' : 'Credentials added to clients will appear here.'}
        />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <SortHeader field="platform_name">Platform</SortHeader>
                <SortHeader field="client">Client</SortHeader>
                <SortHeader field="username">Username</SortHeader>
                <TableHead className="text-muted-foreground">Password</TableHead>
                <TableHead className="text-muted-foreground">POC</TableHead>
                <SortHeader field="scope">Scope</SortHeader>
                <TableHead className="text-muted-foreground w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((cred) => (
                <TableRow key={cred.id} className="border-border">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{cred.platform_name}</span>
                      {cred.platform_url && (
                        <a href={cred.platform_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link href={`/clients/${cred.client_id}`} className="text-blue-400 hover:underline text-sm">
                      {cred.clients?.company_name || 'Unknown'}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{cred.username}</TableCell>
                  <TableCell>
                    {revealedPasswords[cred.id] ? (
                      <div className="flex items-center gap-1">
                        <code className="text-xs bg-muted px-2 py-0.5 rounded max-w-[140px] truncate">{revealedPasswords[cred.id]}</code>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { navigator.clipboard.writeText(revealedPasswords[cred.id]); toast.success('Copied') }}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleRevealPassword(cred.id)}>
                          <EyeOff className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => handleRevealPassword(cred.id)} disabled={revealingId === cred.id}>
                        <Eye className="h-3 w-3 mr-1" />{revealingId === cred.id ? '...' : 'Reveal'}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{cred.poc || '\u2014'}</TableCell>
                  <TableCell>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${cred.scope === 'personal' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}`}>
                      {cred.scope}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <CredentialForm clientId={cred.client_id} credential={cred} onSuccess={fetchCredentials} trigger={<Button variant="ghost" size="icon" className="h-6 w-6"><Edit className="h-3 w-3" /></Button>} />
                      {(can('delete') || cred.scope === 'personal') && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-400" onClick={() => handleDelete(cred.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
