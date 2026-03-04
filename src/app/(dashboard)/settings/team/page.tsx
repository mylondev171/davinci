'use client'

import { useEffect, useState, useCallback } from 'react'
import { useOrg } from '@/providers/org-provider'
import { useApi } from '@/lib/hooks/use-api'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { InviteDialog } from '@/components/team/invite-dialog'
import { toast } from 'sonner'
import { Copy, Trash2, X } from 'lucide-react'

interface Member {
  user_id: string
  role: string
  profiles: { full_name: string | null; avatar_url: string | null; email: string }
}

interface Invitation {
  id: string
  email: string
  role: string
  status: string
  token: string
  created_at: string
  expires_at: string
}

export default function TeamPage() {
  const { currentOrg } = useOrg()
  const { apiFetch } = useApi()
  const { can, isOwner } = usePermissions()
  const supabase = createClient()
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMembers = useCallback(async () => {
    if (!currentOrg) return
    const { data } = await supabase
      .from('memberships')
      .select('user_id, role, profiles:user_id(full_name, avatar_url, email)')
      .eq('org_id', currentOrg.id)
    setMembers((data as unknown as Member[]) || [])
  }, [currentOrg, supabase])

  const fetchInvitations = useCallback(async () => {
    if (!currentOrg || !can('invite')) return
    try {
      const result = await apiFetch('/api/invitations')
      setInvitations(result.data || [])
    } catch {
      // User may not have permission
    }
  }, [currentOrg, can, apiFetch])

  useEffect(() => {
    const load = async () => {
      await Promise.all([fetchMembers(), fetchInvitations()])
      setLoading(false)
    }
    load()
  }, [fetchMembers, fetchInvitations])

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      await apiFetch(`/api/memberships/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      })
      toast.success('Role updated')
      fetchMembers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update role')
    }
  }

  const handleRemoveMember = async (userId: string, name: string) => {
    try {
      await apiFetch(`/api/memberships/${userId}`, { method: 'DELETE' })
      toast.success(`${name} removed from organization`)
      fetchMembers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove member')
    }
  }

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      await apiFetch(`/api/invitations/${invitationId}`, { method: 'DELETE' })
      toast.success('Invitation revoked')
      fetchInvitations()
    } catch (error) {
      toast.error('Failed to revoke invitation')
    }
  }

  const handleCopyInviteLink = async (token: string) => {
    const baseUrl = window.location.origin
    await navigator.clipboard.writeText(`${baseUrl}/api/invitations/accept?token=${token}`)
    toast.success('Invite link copied!')
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team</h1>
          <p className="text-muted-foreground">Manage your organization members</p>
        </div>
        {can('invite') && (
          <InviteDialog onInviteSent={() => fetchInvitations()} />
        )}
      </div>

      {/* Pending Invitations */}
      {can('invite') && invitations.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Pending Invitations ({invitations.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {invitations.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{invite.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Invited as <span className="capitalize">{invite.role}</span>
                    {' \u00B7 '}
                    Expires {new Date(invite.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleCopyInviteLink(invite.token)}
                    title="Copy invite link"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-red-400"
                    onClick={() => handleRevokeInvitation(invite.id)}
                    title="Revoke invitation"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Members */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map((member) => {
            const isOwnerMember = member.role === 'owner'
            const memberName = member.profiles?.full_name || 'Unnamed'

            return (
              <div key={member.user_id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.profiles?.avatar_url || ''} />
                    <AvatarFallback className="bg-muted text-xs">
                      {member.profiles?.full_name?.[0] || member.profiles?.email?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">{memberName}</p>
                    <p className="text-xs text-muted-foreground">{member.profiles?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {can('manage_roles') && !isOwnerMember ? (
                    <Select
                      value={member.role}
                      onValueChange={(v) => handleChangeRole(member.user_id, v)}
                    >
                      <SelectTrigger className="w-28 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {isOwner && <SelectItem value="admin">Admin</SelectItem>}
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="capitalize">{member.role}</Badge>
                  )}
                  {isOwner && !isOwnerMember && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-400">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove {memberName}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove them from your organization. They will lose access to all organization data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveMember(member.user_id, memberName)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
