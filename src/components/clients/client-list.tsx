'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useApi } from '@/lib/hooks/use-api'
import { useOrg } from '@/providers/org-provider'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { Users, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { ClientForm } from './client-form'
import type { Database } from '@/types/database'

type Client = Database['public']['Tables']['clients']['Row'] & {
  contacts?: { id: string; first_name: string; last_name: string; email: string | null; is_primary: boolean }[]
}

type SortField = 'company_name' | 'industry' | 'status' | 'pipeline_stage' | 'updated_at'

export function ClientList() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortField>('updated_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const router = useRouter()
  const { apiFetch } = useApi()
  const { currentOrg } = useOrg()

  const fetchClients = useCallback(async () => {
    if (!currentOrg) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      params.set('sort_by', sortBy)
      params.set('sort_dir', sortDir)
      const { data } = await apiFetch(`/api/clients?${params}`)
      setClients(data || [])
    } catch (error) {
      console.error('Error fetching clients:', error)
    } finally {
      setLoading(false)
    }
  }, [apiFetch, currentOrg, search, statusFilter, sortBy, sortDir])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortDir(field === 'company_name' || field === 'industry' ? 'asc' : 'desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 text-foreground" />
      : <ArrowDown className="h-3 w-3 text-foreground" />
  }

  const SortableHead = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <SortIcon field={field} />
      </div>
    </TableHead>
  )

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="lead">Lead</SelectItem>
            <SelectItem value="prospect">Prospect</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="churned">Churned</SelectItem>
          </SelectContent>
        </Select>
        <ClientForm onSuccess={fetchClients} />
      </div>

      {/* Table */}
      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="Add your first client to start tracking relationships and projects."
        />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <SortableHead field="company_name">Company</SortableHead>
                <SortableHead field="industry">Industry</SortableHead>
                <TableHead className="text-muted-foreground">Primary Contact</TableHead>
                <SortableHead field="status">Status</SortableHead>
                <SortableHead field="pipeline_stage">Pipeline</SortableHead>
                <SortableHead field="updated_at">Updated</SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => {
                const primaryContact = client.contacts?.find((c) => c.is_primary) || client.contacts?.[0]
                return (
                  <TableRow
                    key={client.id}
                    className="border-border cursor-pointer hover:bg-accent/50"
                    onClick={() => router.push(`/clients/${client.id}`)}
                  >
                    <TableCell className="font-medium text-foreground">
                      {client.company_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {client.industry || '\u2014'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {primaryContact
                        ? `${primaryContact.first_name} ${primaryContact.last_name}`
                        : '\u2014'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={client.status} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={client.pipeline_stage} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(client.updated_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
