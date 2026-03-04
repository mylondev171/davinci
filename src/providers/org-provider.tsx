'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useSupabase } from './supabase-provider'
import type { Database } from '@/types/database'

type Organization = Database['public']['Tables']['organizations']['Row']
type Membership = Database['public']['Tables']['memberships']['Row']

type OrgContextType = {
  currentOrg: Organization | null
  organizations: Organization[]
  memberships: Membership[]
  switchOrg: (orgId: string) => void
  loading: boolean
  userRole: 'owner' | 'admin' | 'member' | null
}

const OrgContext = createContext<OrgContextType | undefined>(undefined)

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { supabase } = useSupabase()
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOrganizations = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch memberships
      const { data: membershipData } = await supabase
        .from('memberships')
        .select('*')
        .eq('user_id', user.id)

      if (!membershipData || membershipData.length === 0) return

      setMemberships(membershipData)

      // Fetch organizations
      const orgIds = membershipData.map(m => m.org_id)
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .in('id', orgIds)

      if (orgData) {
        setOrganizations(orgData)

        // Get user's profile to check default org
        const { data: profile } = await supabase
          .from('profiles')
          .select('default_org_id')
          .eq('id', user.id)
          .single()

        // Try to restore from localStorage, then default_org, then first org
        const storedOrgId = typeof window !== 'undefined' ? localStorage.getItem('currentOrgId') : null
        const defaultOrg = orgData.find(o => o.id === storedOrgId)
          || orgData.find(o => o.id === profile?.default_org_id)
          || orgData[0]

        if (defaultOrg) {
          setCurrentOrg(defaultOrg)
        }
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchOrganizations()
  }, [fetchOrganizations])

  const switchOrg = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId)
    if (org) {
      setCurrentOrg(org)
      localStorage.setItem('currentOrgId', orgId)
    }
  }

  const userRole = currentOrg
    ? (memberships.find(m => m.org_id === currentOrg.id)?.role ?? null)
    : null

  return (
    <OrgContext.Provider value={{ currentOrg, organizations, memberships, switchOrg, loading, userRole }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg() {
  const context = useContext(OrgContext)
  if (!context) {
    throw new Error('useOrg must be used within an OrgProvider')
  }
  return context
}
