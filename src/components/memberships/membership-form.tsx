'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApi } from '@/lib/hooks/use-api'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import type { Database } from '@/types/database'

type ServiceMembership = Database['public']['Tables']['service_memberships']['Row']

interface MembershipFormProps {
  membership?: ServiceMembership
  onSuccess?: () => void
  trigger?: React.ReactNode
}

export function MembershipForm({ membership, onSuccess, trigger }: MembershipFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { apiFetch } = useApi()

  const [formData, setFormData] = useState({
    service_name: membership?.service_name || '',
    service_url: membership?.service_url || '',
    membership_level: membership?.membership_level || '',
    cost: membership?.cost?.toString() || '',
    billing_cycle: membership?.billing_cycle || '' as string,
    flagged_for_removal: membership?.flagged_for_removal || false,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        service_name: formData.service_name,
        service_url: formData.service_url,
        membership_level: formData.membership_level,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        billing_cycle: formData.billing_cycle || null,
        flagged_for_removal: formData.flagged_for_removal,
      }

      if (membership) {
        await apiFetch(`/api/memberships-tracker/${membership.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        toast.success('Membership updated')
      } else {
        await apiFetch('/api/memberships-tracker', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        toast.success('Membership added')
      }
      setOpen(false)
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Membership
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{membership ? 'Edit Membership' : 'Add Membership'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="service_name">Service Name *</Label>
            <Input
              id="service_name"
              value={formData.service_name}
              onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
              placeholder="e.g., Claude, SEMRush, Vercel"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="service_url">URL</Label>
            <Input
              id="service_url"
              value={formData.service_url}
              onChange={(e) => setFormData({ ...formData, service_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="membership_level">Membership Level</Label>
            <Input
              id="membership_level"
              value={formData.membership_level}
              onChange={(e) => setFormData({ ...formData, membership_level: e.target.value })}
              placeholder="e.g., Pro, Enterprise, Team"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost">Cost ($)</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                min="0"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing_cycle">Billing Cycle</Label>
              <Select value={formData.billing_cycle} onValueChange={(v) => setFormData({ ...formData, billing_cycle: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="flagged_for_removal"
              checked={formData.flagged_for_removal}
              onChange={(e) => setFormData({ ...formData, flagged_for_removal: e.target.checked })}
              className="rounded border-border"
            />
            <Label htmlFor="flagged_for_removal" className="text-sm">Flag for removal</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : membership ? 'Update' : 'Add'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
