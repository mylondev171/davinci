'use client'

import { useOrg } from '@/providers/org-provider'
import { hasPermission, type Permission, type Role } from '@/lib/permissions'

export function usePermissions() {
  const { userRole } = useOrg()

  const can = (permission: Permission): boolean => {
    if (!userRole) return false
    return hasPermission(userRole, permission)
  }

  return {
    can,
    isOwner: userRole === 'owner',
    isAdmin: userRole === 'admin',
    isMember: userRole === 'member',
    userRole: userRole as Role | null,
  }
}
