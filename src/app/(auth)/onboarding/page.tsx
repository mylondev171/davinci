'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function OnboardingPage() {
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgName.trim()) return

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const orgId = crypto.randomUUID()

      // Create organization with known ID
      const { error: orgError } = await supabase
        .from('organizations')
        .insert({ id: orgId, name: orgName, slug })

      if (orgError) throw orgError

      // Create membership as owner
      const { error: memberError } = await supabase
        .from('memberships')
        .insert({ user_id: user.id, org_id: orgId, role: 'owner' })

      if (memberError) throw memberError

      // Set as default org
      await supabase
        .from('profiles')
        .update({ default_org_id: orgId })
        .eq('id', user.id)

      router.push('/dashboard')
    } catch (error) {
      console.error('Error creating organization:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-border bg-card/50 backdrop-blur">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-foreground">Create Your Organization</CardTitle>
        <CardDescription className="text-muted-foreground">
          Set up your agency workspace to get started
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreateOrg} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName">Organization Name</Label>
            <Input
              id="orgName"
              placeholder="My Digital Agency"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={loading || !orgName.trim()}
          >
            {loading ? 'Creating...' : 'Create Organization'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
