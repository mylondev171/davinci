'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useApi } from '@/lib/hooks/use-api'
import { toast } from 'sonner'
import { Clock } from 'lucide-react'

interface TimeEntry { id: string; date: string; hours: number; note: string | null; billable: boolean }

interface Props {
  taskId: string
  taskTitle: string
  entry?: TimeEntry
  prefillHours?: number
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSuccess?: () => void
  trigger?: React.ReactNode
}

export function TimeEntryForm({ taskId, taskTitle, entry, prefillHours, open: controlledOpen, onOpenChange, onSuccess, trigger }: Props) {
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? (v: boolean) => onOpenChange?.(v) : setInternalOpen

  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(entry?.date ?? today)
  const [hours, setHours] = useState(entry?.hours?.toString() ?? prefillHours?.toString() ?? '')
  const [note, setNote] = useState(entry?.note ?? '')
  const [billable, setBillable] = useState(entry?.billable ?? true)
  const [loading, setLoading] = useState(false)
  const { apiFetch } = useApi()

  useEffect(() => {
    if (open) {
      setDate(entry?.date ?? today)
      setHours(entry?.hours?.toString() ?? prefillHours?.toString() ?? '')
      setNote(entry?.note ?? '')
      setBillable(entry?.billable ?? true)
    }
  }, [open, entry, prefillHours, today])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const h = parseFloat(hours)
    if (!h || h <= 0 || h > 24) { toast.error('Hours must be between 0 and 24'); return }
    setLoading(true)
    try {
      if (entry) {
        await apiFetch(`/api/time-entries/${entry.id}`, { method: 'PATCH', body: JSON.stringify({ date, hours: h, note: note || null, billable }) })
        toast.success('Time entry updated')
      } else {
        await apiFetch('/api/time-entries', { method: 'POST', body: JSON.stringify({ task_id: taskId, date, hours: h, note: note || null, billable }) })
        toast.success('Time logged')
      }
      setOpen(false)
      onSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger ?? <Button variant="ghost" size="sm" className="h-6 px-2 text-xs"><Clock className="h-3 w-3 mr-1" />Log Time</Button>}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{entry ? 'Edit Time Entry' : `Log Time — ${taskTitle}`}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Hours</Label>
              <Input type="number" step="0.01" min="0.01" max="24" placeholder="1.5" value={hours} onChange={(e) => setHours(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you work on?" className="min-h-[60px]" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="billable" checked={billable} onChange={(e) => setBillable(e.target.checked)} className="rounded" />
            <Label htmlFor="billable" className="cursor-pointer">Billable</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !hours}>{loading ? 'Saving...' : entry ? 'Update' : 'Log Time'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
