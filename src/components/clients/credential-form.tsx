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

interface CredentialFormProps {
  clientId: string
  credential?: {
    id: string
    platform_name: string
    platform_url: string | null
    username: string
    poc: string | null
    scope: 'organization' | 'personal'
  }
  onSuccess?: () => void
  trigger?: React.ReactNode
}

export function CredentialForm({ clientId, credential, onSuccess, trigger }: CredentialFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { apiFetch } = useApi()

  const [formData, setFormData] = useState({
    platform_name: credential?.platform_name || '',
    platform_url: credential?.platform_url || '',
    username: credential?.username || '',
    password: '',
    poc: credential?.poc || '',
    scope: credential?.scope || 'organization' as 'organization' | 'personal',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (credential) {
        const body: Record<string, unknown> = {
          platform_name: formData.platform_name,
          platform_url: formData.platform_url,
          username: formData.username,
          poc: formData.poc,
          scope: formData.scope,
        }
        // Only send password if user entered a new one
        if (formData.password) body.password = formData.password
        await apiFetch(`/api/client-credentials/${credential.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
        toast.success('Credential updated')
      } else {
        await apiFetch('/api/client-credentials', {
          method: 'POST',
          body: JSON.stringify({ ...formData, client_id: clientId }),
        })
        toast.success('Credential added')
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
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-3 w-3" />
            Add Credential
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{credential ? 'Edit Credential' : 'Add Credential'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="platform_name">Platform Name *</Label>
            <Input
              id="platform_name"
              value={formData.platform_name}
              onChange={(e) => setFormData({ ...formData, platform_name: e.target.value })}
              placeholder="e.g., WordPress, cPanel, GoDaddy"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="platform_url">URL</Label>
            <Input
              id="platform_url"
              value={formData.platform_url}
              onChange={(e) => setFormData({ ...formData, platform_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password {credential ? '' : '*'}</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={credential ? '(unchanged)' : ''}
                required={!credential}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="poc">Point of Contact</Label>
            <Input
              id="poc"
              value={formData.poc}
              onChange={(e) => setFormData({ ...formData, poc: e.target.value })}
              placeholder="Who manages this account?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="scope">Visibility</Label>
            <Select value={formData.scope} onValueChange={(v) => setFormData({ ...formData, scope: v as 'organization' | 'personal' })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="organization">Organization (visible to all members)</SelectItem>
                <SelectItem value="personal">Personal (only you)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : credential ? 'Update' : 'Add'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
