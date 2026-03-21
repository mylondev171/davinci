'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useApi } from '@/lib/hooks/use-api'
import { useOrg } from '@/providers/org-provider'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { StatusBadge } from '@/components/shared/status-badge'
import { ClientForm } from '@/components/clients/client-form'
import { ContactForm } from '@/components/clients/contact-form'
import { ActivityTimeline } from '@/components/clients/activity-timeline'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import { CredentialForm } from '@/components/clients/credential-form'
import { ClientTimesheetTab } from '@/components/clients/timesheet-tab'
import { ClientTasksTab } from '@/components/clients/tasks-tab'
import { ArrowLeft, Globe, Mail, Phone, Trash2, Pin, Edit, Eye, EyeOff, Copy, ExternalLink, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import type { Database } from '@/types/database'

type Client = Database['public']['Tables']['clients']['Row']
type Contact = Database['public']['Tables']['contacts']['Row']

interface ClientDetail extends Client {
  contacts: Contact[]
  projects: { id: string; name: string; status: string; priority: string; due_date: string | null }[]
  notes: { id: string; content: string; pinned: boolean; author_id: string; created_at: string }[]
}

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const [client, setClient] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [credentials, setCredentials] = useState<{ id: string; platform_name: string; platform_url: string | null; username: string; poc: string | null; scope: 'organization' | 'personal'; created_by: string; created_at: string }[]>([])
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({})
  const [revealingId, setRevealingId] = useState<string | null>(null)
  const router = useRouter()
  const { apiFetch } = useApi()
  const { currentOrg } = useOrg()
  const { can } = usePermissions()

  const fetchClient = useCallback(async () => {
    try {
      const { data } = await apiFetch(`/api/clients/${clientId}`)
      setClient(data)
    } catch (error) {
      console.error('Error fetching client:', error)
      toast.error('Client not found')
    } finally {
      setLoading(false)
    }
  }, [apiFetch, clientId])

  useEffect(() => {
    if (currentOrg) fetchClient()
  }, [fetchClient, currentOrg])

  const handleDeleteClient = async () => {
    setDeleting(true)
    try {
      await apiFetch(`/api/clients/${clientId}`, { method: 'DELETE' })
      toast.success('Client deleted')
      router.push('/clients')
    } catch (error) {
      toast.error('Failed to delete client')
      setDeleting(false)
    }
  }

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    setSavingNote(true)
    try {
      await apiFetch('/api/notes', {
        method: 'POST',
        body: JSON.stringify({ client_id: clientId, content: newNote }),
      })
      setNewNote('')
      fetchClient()
      toast.success('Note added')
    } catch (error) {
      toast.error('Failed to add note')
    } finally {
      setSavingNote(false)
    }
  }

  const fetchCredentials = useCallback(async () => {
    try {
      const { data } = await apiFetch(`/api/client-credentials?client_id=${clientId}`)
      setCredentials(data || [])
    } catch {
      // Silently fail — credentials tab just won't show data
    }
  }, [apiFetch, clientId])

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

  const handleDeleteCredential = async (credentialId: string) => {
    try {
      await apiFetch(`/api/client-credentials/${credentialId}`, { method: 'DELETE' })
      fetchCredentials()
      toast.success('Credential deleted')
    } catch {
      toast.error('Failed to delete credential')
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    try {
      await apiFetch(`/api/notes?id=${noteId}`, { method: 'DELETE' })
      fetchClient()
      toast.success('Note deleted')
    } catch (error) {
      toast.error('Failed to delete note')
    }
  }

  if (loading) return <LoadingSpinner />
  if (!client) return <p className="text-muted-foreground">Client not found.</p>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/clients')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{client.company_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={client.status} />
              <StatusBadge status={client.pipeline_stage} />
              {client.industry && <span className="text-sm text-muted-foreground">{client.industry}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ClientForm client={client} onSuccess={fetchClient} trigger={<Button variant="outline" size="sm"><Edit className="mr-2 h-3 w-3" />Edit</Button>} />
          {can('delete') && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-red-400 border-red-400/30 hover:bg-red-400/10">
                  <Trash2 className="mr-2 h-3 w-3" />Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {client.company_name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this client and all associated data. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteClient}
                    disabled={deleting}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="projects">Projects ({client.projects?.length || 0})</TabsTrigger>
          <TabsTrigger value="credentials">Credentials ({credentials.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({client.notes?.length || 0})</TabsTrigger>
          <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Client Info */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {client.website && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                      {client.website}
                    </a>
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  <span className="text-muted-foreground">Added </span>
                  {formatDistanceToNow(new Date(client.created_at), { addSuffix: true })}
                </div>
              </CardContent>
            </Card>

            {/* Contacts */}
            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-foreground">Contacts</CardTitle>
                <ContactForm clientId={clientId} onSuccess={fetchClient} />
              </CardHeader>
              <CardContent className="space-y-3">
                {client.contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No contacts yet.</p>
                ) : (
                  client.contacts.map((contact) => (
                    <div key={contact.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-muted text-xs">
                          {contact.first_name[0]}{contact.last_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {contact.first_name} {contact.last_name}
                          </span>
                          {contact.is_primary && (
                            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">Primary</span>
                          )}
                        </div>
                        {contact.title && <p className="text-xs text-muted-foreground">{contact.title}</p>}
                        <div className="flex items-center gap-3 mt-1">
                          {contact.email && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />{contact.email}
                            </span>
                          )}
                          {contact.phone && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />{contact.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="projects" className="mt-6">
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              {client.projects?.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No projects linked to this client yet.</p>
              ) : (
                <div className="space-y-2">
                  {client.projects?.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3 cursor-pointer hover:bg-accent/50"
                      onClick={() => router.push(`/projects/${project.id}`)}
                    >
                      <div>
                        <span className="text-sm font-medium text-foreground">{project.name}</span>
                        {project.due_date && (
                          <p className="text-xs text-muted-foreground">Due {new Date(project.due_date).toLocaleDateString()}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={project.priority} />
                        <StatusBadge status={project.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credentials" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <CredentialForm clientId={clientId} onSuccess={fetchCredentials} />
          </div>
          {credentials.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground py-4">No credentials stored for this client yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {credentials.map((cred) => (
                <Card key={cred.id} className="border-border bg-card">
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">{cred.platform_name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${cred.scope === 'personal' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}`}>
                          {cred.scope}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CredentialForm clientId={clientId} credential={cred} onSuccess={fetchCredentials} trigger={<Button variant="ghost" size="icon" className="h-6 w-6"><Edit className="h-3 w-3" /></Button>} />
                        {(can('delete') || cred.scope === 'personal') && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-400" onClick={() => handleDeleteCredential(cred.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {cred.platform_url && (
                      <a href={cred.platform_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:underline">
                        <ExternalLink className="h-3 w-3" />{cred.platform_url}
                      </a>
                    )}
                    <div className="text-sm space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs w-16">Username</span>
                        <span className="text-foreground">{cred.username}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs w-16">Password</span>
                        {revealedPasswords[cred.id] ? (
                          <div className="flex items-center gap-1">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{revealedPasswords[cred.id]}</code>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { navigator.clipboard.writeText(revealedPasswords[cred.id]); toast.success('Copied') }}>
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleRevealPassword(cred.id)}>
                              <EyeOff className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => handleRevealPassword(cred.id)} disabled={revealingId === cred.id}>
                            <Eye className="h-3 w-3 mr-1" />{revealingId === cred.id ? 'Loading...' : 'Reveal'}
                          </Button>
                        )}
                      </div>
                      {cred.poc && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-xs w-16">POC</span>
                          <span className="text-foreground">{cred.poc}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-6 space-y-4">
          {/* Add note */}
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <Textarea
                placeholder="Add a note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="min-h-[80px]"
              />
              <div className="flex justify-end mt-2">
                <Button onClick={handleAddNote} disabled={savingNote || !newNote.trim()} size="sm">
                  {savingNote ? 'Saving...' : 'Add Note'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notes list */}
          {client.notes?.map((note) => (
            <Card key={note.id} className="border-border bg-card">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {note.pinned && <Pin className="h-3 w-3 text-blue-400 inline mr-1" />}
                    <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {can('delete') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-red-400"
                      onClick={() => handleDeleteNote(note.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="timesheets" className="mt-6">
          <ClientTimesheetTab
            clientId={clientId}
            clientName={client.company_name}
            projects={client.projects || []}
          />
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <ClientTasksTab clientId={clientId} />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <ActivityTimeline clientId={clientId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
