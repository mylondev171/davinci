'use client'

import { useEffect, useState, useCallback } from 'react'
import { useApi } from '@/lib/hooks/use-api'
import { useOrg } from '@/providers/org-provider'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { MembershipForm } from '@/components/memberships/membership-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DollarSign, AlertTriangle, CreditCard, Edit, Trash2, ExternalLink, Flag } from 'lucide-react'
import { toast } from 'sonner'
import type { Database } from '@/types/database'

type ServiceMembership = Database['public']['Tables']['service_memberships']['Row'] & {
  owner: { full_name: string | null; avatar_url: string | null } | null
}

export default function MembershipsPage() {
  const [memberships, setMemberships] = useState<ServiceMembership[]>([])
  const [loading, setLoading] = useState(true)
  const { apiFetch } = useApi()
  const { currentOrg } = useOrg()
  const { can } = usePermissions()

  const fetchMemberships = useCallback(async () => {
    try {
      const { data } = await apiFetch('/api/memberships-tracker')
      setMemberships(data || [])
    } catch {
      toast.error('Failed to load memberships')
    } finally {
      setLoading(false)
    }
  }, [apiFetch])

  useEffect(() => {
    if (currentOrg) fetchMemberships()
  }, [fetchMemberships, currentOrg])

  const handleToggleFlag = async (membership: ServiceMembership) => {
    try {
      await apiFetch(`/api/memberships-tracker/${membership.id}`, {
        method: 'PUT',
        body: JSON.stringify({ flagged_for_removal: !membership.flagged_for_removal }),
      })
      fetchMemberships()
      toast.success(membership.flagged_for_removal ? 'Unflagged' : 'Flagged for removal')
    } catch {
      toast.error('Failed to update')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/memberships-tracker/${id}`, { method: 'DELETE' })
      fetchMemberships()
      toast.success('Membership deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  // Compute summary
  const monthlyCost = memberships
    .filter((m) => m.billing_cycle === 'monthly' && m.cost)
    .reduce((sum, m) => sum + (m.cost || 0), 0)
  const yearlyCost = memberships
    .filter((m) => m.billing_cycle === 'yearly' && m.cost)
    .reduce((sum, m) => sum + (m.cost || 0), 0)
  const flaggedCount = memberships.filter((m) => m.flagged_for_removal).length

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Service Memberships</h1>
          <p className="text-muted-foreground">Track your organization&apos;s subscriptions and services</p>
        </div>
        <MembershipForm onSuccess={fetchMemberships} />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">${monthlyCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">/month</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Yearly Cost</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">${yearlyCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">/year</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Flagged for Removal</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{flaggedCount}</div>
            <p className="text-xs text-muted-foreground">{flaggedCount === 1 ? 'service' : 'services'} pending cancellation</p>
          </CardContent>
        </Card>
      </div>

      {/* Memberships List */}
      {memberships.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground py-4">No service memberships tracked yet. Add your first one above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {memberships.map((membership) => (
            <Card key={membership.id} className={`border-border bg-card ${membership.flagged_for_removal ? 'border-amber-500/30' : ''}`}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{membership.service_name}</span>
                        {membership.membership_level && (
                          <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">
                            {membership.membership_level}
                          </span>
                        )}
                        {membership.flagged_for_removal && (
                          <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <AlertTriangle className="h-2.5 w-2.5" />Flagged
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        {membership.service_url && (
                          <a href={membership.service_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:underline">
                            <ExternalLink className="h-3 w-3" />{membership.service_url}
                          </a>
                        )}
                        {membership.cost != null && (
                          <span className="text-sm text-muted-foreground">
                            ${Number(membership.cost).toFixed(2)}{membership.billing_cycle ? `/${membership.billing_cycle === 'monthly' ? 'mo' : 'yr'}` : ''}
                          </span>
                        )}
                        {membership.owner && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Avatar className="h-4 w-4">
                              <AvatarImage src={membership.owner.avatar_url || ''} />
                              <AvatarFallback className="text-[8px]">{membership.owner.full_name?.[0] || '?'}</AvatarFallback>
                            </Avatar>
                            {membership.owner.full_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 text-xs ${membership.flagged_for_removal ? 'text-amber-400' : 'text-muted-foreground'}`}
                      onClick={() => handleToggleFlag(membership)}
                    >
                      <Flag className="h-3 w-3 mr-1" />
                      {membership.flagged_for_removal ? 'Unflag' : 'Flag'}
                    </Button>
                    <MembershipForm
                      membership={membership}
                      onSuccess={fetchMemberships}
                      trigger={<Button variant="ghost" size="icon" className="h-7 w-7"><Edit className="h-3 w-3" /></Button>}
                    />
                    {can('delete') && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-400">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {membership.service_name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove this membership record.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(membership.id)} className="bg-red-600 hover:bg-red-700">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
