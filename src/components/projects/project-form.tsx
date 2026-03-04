'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApi } from '@/lib/hooks/use-api'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

interface ProjectFormProps {
  project?: {
    id: string
    name: string
    description: string | null
    client_id: string | null
    status: string
    priority: string
    start_date: string | null
    due_date: string | null
    budget: number | null
  }
  defaultClientId?: string
  onSuccess?: () => void
  trigger?: React.ReactNode
}

export function ProjectForm({ project, defaultClientId, onSuccess, trigger }: ProjectFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([])
  const { apiFetch } = useApi()

  const [formData, setFormData] = useState({
    name: project?.name || '',
    description: project?.description || '',
    client_id: project?.client_id || defaultClientId || '',
    status: project?.status || 'planning',
    priority: project?.priority || 'medium',
    start_date: project?.start_date || '',
    due_date: project?.due_date || '',
    budget: project?.budget?.toString() || '',
  })

  useEffect(() => {
    if (open) {
      apiFetch('/api/clients?limit=100')
        .then(({ data }) => setClients(data || []))
        .catch(() => {})
    }
  }, [open, apiFetch])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        ...formData,
        client_id: formData.client_id && formData.client_id !== 'none' ? formData.client_id : null,
        budget: formData.budget ? parseFloat(formData.budget) : null,
        start_date: formData.start_date || null,
        due_date: formData.due_date || null,
      }

      if (project) {
        await apiFetch(`/api/projects/${project.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        toast.success('Project updated')
      } else {
        await apiFetch('/api/projects', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        toast.success('Project created')
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
            New Project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{project ? 'Edit Project' : 'New Project'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Website Redesign"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Project details..."
              className="min-h-[60px]"
            />
          </div>
          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select a client (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No client</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['planning', 'active', 'on_hold', 'completed', 'cancelled'].map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['low', 'medium', 'high', 'urgent'].map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Budget ($)</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.budget}
              onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !formData.name.trim()}>
              {loading ? 'Saving...' : project ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
