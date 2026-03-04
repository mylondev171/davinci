'use client'

import { useOrg } from '@/providers/org-provider'
import { useCallback } from 'react'

export function useApi() {
  const { currentOrg } = useOrg()

  const apiFetch = useCallback(
    async (url: string, options?: RequestInit) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options?.headers as Record<string, string> || {}),
      }

      if (currentOrg?.id) {
        headers['x-org-id'] = currentOrg.id
      }

      const response = await fetch(url, {
        ...options,
        headers,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(error.error || 'Request failed')
      }

      return response.json()
    },
    [currentOrg?.id]
  )

  return { apiFetch }
}
