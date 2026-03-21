'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApi } from '@/lib/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TimeEntryForm } from '@/components/tasks/time-entry-form'
import { Skeleton } from '@/components/ui/skeleton'
import { Trash2, Download, FileText } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Entry {
  id: string; date: string; hours: number; note: string | null; billable: boolean
  tasks: { id: string; title: string } | null
  projects: { id: string; name: string } | null
  profiles: { id: string; full_name: string | null } | null
}

interface Props {
  clientId: string
  clientName: string
  projects: { id: string; name: string }[]
}

function startOfMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }
function today() { return new Date().toISOString().split('T')[0] }

export function ClientTimesheetTab({ clientId, clientName, projects }: Props) {
  const { apiFetch } = useApi()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [start, setStart] = useState(startOfMonth)
  const [end, setEnd] = useState(today)
  const [projectFilter, setProjectFilter] = useState('all')
  const [memberFilter, setMemberFilter] = useState('all')
  const [billableFilter, setBillableFilter] = useState('all')
  const [members, setMembers] = useState<{ user_id: string; profiles: { id: string; full_name: string | null } | null }[]>([])

  useEffect(() => {
    apiFetch('/api/memberships').then(({ data }) => setMembers(data || [])).catch(() => {})
  }, [apiFetch])

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ client_id: clientId, start, end })
      if (projectFilter !== 'all') p.set('project_id', projectFilter)
      if (memberFilter !== 'all') p.set('user_id', memberFilter)
      if (billableFilter !== 'all') p.set('billable', billableFilter)
      const { data } = await apiFetch(`/api/time-entries?${p}`)
      setEntries(data || [])
    } catch { toast.error('Failed to load timesheet') }
    finally { setLoading(false) }
  }, [apiFetch, clientId, start, end, projectFilter, memberFilter, billableFilter])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/time-entries/${id}`, { method: 'DELETE' })
      fetchEntries()
      toast.success('Entry deleted')
    } catch { toast.error('Failed to delete') }
  }

  const totalHours = entries.reduce((s, e) => s + e.hours, 0)
  const billableHours = entries.filter((e) => e.billable).reduce((s, e) => s + e.hours, 0)
  const nonBillableHours = totalHours - billableHours

  const exportCSV = () => {
    const rows = [
      ['Date', 'Project', 'Task', 'Team Member', 'Hours', 'Billable', 'Note'],
      ...entries.map((e) => [e.date, e.projects?.name || '', e.tasks?.title || '', e.profiles?.full_name || '', e.hours.toString(), e.billable ? 'Yes' : 'No', e.note || '']),
      ['', '', '', 'Total', totalHours.toFixed(2), billableHours.toFixed(2) + ' billable', ''],
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${clientName}-timesheet-${start}-${end}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const exportPDF = async () => {
    if (entries.length > 1000) { toast.error('Too many rows for PDF — use CSV or narrow the date range'); return }
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()
      doc.setFontSize(14)
      doc.text(`${clientName} — Timesheet`, 14, 20)
      doc.setFontSize(10)
      doc.text(`${start} to ${end}`, 14, 28)
      autoTable(doc, {
        startY: 35,
        head: [['Date', 'Project', 'Task', 'Team Member', 'Hours', 'Billable', 'Note']],
        body: [
          ...entries.map((e) => [e.date, e.projects?.name || '', e.tasks?.title || '', e.profiles?.full_name || '', e.hours.toFixed(2), e.billable ? 'Yes' : 'No', e.note || '']),
          ['', '', '', 'Totals', totalHours.toFixed(2), billableHours.toFixed(2) + ' billable', ''],
        ],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 30, 30] },
      })
      doc.save(`${clientName}-timesheet-${start}-${end}.pdf`)
    } catch { toast.error('PDF generation failed') }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-36 h-8 text-sm" />
        <span className="text-muted-foreground text-sm">to</span>
        <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-36 h-8 text-sm" />
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="All projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={memberFilter} onValueChange={setMemberFilter}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="All members" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Members</SelectItem>
            {members.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.profiles?.full_name || m.user_id}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={billableFilter} onValueChange={setBillableFilter}>
          <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">Billable only</SelectItem>
            <SelectItem value="false">Non-billable</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!entries.length}><Download className="h-3 w-3 mr-1" />CSV</Button>
          <Button variant="outline" size="sm" onClick={exportPDF} disabled={!entries.length}><FileText className="h-3 w-3 mr-1" />PDF</Button>
        </div>
      </div>

      {/* Summary */}
      <div className="flex gap-6 text-sm px-1">
        <span className="text-muted-foreground">Total: <span className="text-foreground font-medium">{totalHours.toFixed(2)}h</span></span>
        <span className="text-muted-foreground">Billable: <span className="text-green-400 font-medium">{billableHours.toFixed(2)}h</span></span>
        <span className="text-muted-foreground">Non-billable: <span className="text-foreground font-medium">{nonBillableHours.toFixed(2)}h</span></span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No time logged for this client in the selected period.</p>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {['Date', 'Project', 'Task', 'Team Member', 'Hours', 'Billable', 'Note', ''].map((h) => (
                  <TableHead key={h} className="text-muted-foreground text-xs">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id} className="border-border hover:bg-accent/50 text-sm">
                  <TableCell className="text-muted-foreground whitespace-nowrap">{e.date}</TableCell>
                  <TableCell>{e.projects?.name || '—'}</TableCell>
                  <TableCell className="max-w-[160px] truncate">{e.tasks?.title || '—'}</TableCell>
                  <TableCell>{e.profiles?.full_name || '—'}</TableCell>
                  <TableCell className="font-medium">{e.hours.toFixed(2)}</TableCell>
                  <TableCell><span className={e.billable ? 'text-green-400' : 'text-muted-foreground'}>{e.billable ? 'Yes' : 'No'}</span></TableCell>
                  <TableCell className="text-muted-foreground max-w-[180px] truncate">{e.note || '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <TimeEntryForm
                        taskId={e.tasks?.id || ''}
                        taskTitle={e.tasks?.title || ''}
                        entry={e}
                        onSuccess={fetchEntries}
                      />
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400" onClick={() => setDeletingId(e.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <AlertDialog open={deletingId !== null} onOpenChange={(open) => { if (!open) setDeletingId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Entry?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deletingId) { handleDelete(deletingId); setDeletingId(null) } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
