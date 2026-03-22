'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/providers/org-provider'
import { useApi } from '@/lib/hooks/use-api'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Search, LogOut, Building2, ChevronDown, Sun, Moon, Users, FolderKanban } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { useTheme } from '@/providers/theme-provider'

type SearchResult = {
  id: string
  label: string
  sublabel?: string
  type: 'client' | 'project' | 'task'
  href: string
}

export function Topbar() {
  const router = useRouter()
  const supabase = createClient()
  const { currentOrg, organizations, switchOrg } = useOrg()
  const { apiFetch } = useApi()
  const { theme, setTheme } = useTheme()
  const [user, setUser] = useState<{ email?: string; full_name?: string; avatar_url?: string } | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        setUser({
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name,
          avatar_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture,
        })
      }
    }
    getUser()
  }, [supabase])

  // Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Fetch search results
  const fetchResults = useCallback(async (q: string) => {
    if (!q.trim() || !currentOrg) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const params = new URLSearchParams({ search: q })
      const [clientsRes, projectsRes] = await Promise.allSettled([
        apiFetch(`/api/clients?${params}`),
        apiFetch(`/api/projects?${params}`),
      ])

      const newResults: SearchResult[] = []

      if (clientsRes.status === 'fulfilled') {
        for (const c of (clientsRes.value.data || []).slice(0, 5)) {
          newResults.push({ id: c.id, label: c.company_name, sublabel: c.industry || undefined, type: 'client', href: `/clients/${c.id}` })
        }
      }
      if (projectsRes.status === 'fulfilled') {
        for (const p of (projectsRes.value.data || []).slice(0, 5)) {
          newResults.push({ id: p.id, label: p.name, sublabel: p.clients?.company_name || undefined, type: 'project', href: `/projects/${p.id}` })
        }
      }

      setResults(newResults)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [apiFetch, currentOrg])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    const timer = setTimeout(() => fetchResults(query), 300)
    return () => clearTimeout(timer)
  }, [query, fetchResults])

  const handleSelect = (href: string) => {
    setOpen(false)
    setQuery('')
    router.push(href)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = user?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'

  const clientResults = results.filter((r) => r.type === 'client')
  const projectResults = results.filter((r) => r.type === 'project')

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      {/* Search */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground w-96 cursor-pointer hover:bg-accent/50 transition-colors"
      >
        <Search className="h-4 w-4" />
        <span>Search clients, projects, tasks...</span>
        <kbd className="ml-auto rounded border border-border bg-accent px-1.5 py-0.5 text-xs text-muted-foreground">
          Ctrl+K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery('') }}>
        <DialogContent className="overflow-hidden p-0">
          <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
            <CommandInput
              placeholder="Search clients, projects, tasks..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {!searching && query.trim() && results.length === 0 && (
                <CommandEmpty>No results found.</CommandEmpty>
              )}
              {!query.trim() && (
                <CommandEmpty>Start typing to search...</CommandEmpty>
              )}
              {clientResults.length > 0 && (
                <CommandGroup heading="Clients">
                  {clientResults.map((r) => (
                    <CommandItem key={r.id} value={r.id} onSelect={() => handleSelect(r.href)}>
                      <Users className="h-4 w-4 shrink-0" />
                      <span>{r.label}</span>
                      {r.sublabel && <span className="text-muted-foreground text-xs ml-1">— {r.sublabel}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {projectResults.length > 0 && (
                <CommandGroup heading="Projects">
                  {projectResults.map((r) => (
                    <CommandItem key={r.id} value={r.id} onSelect={() => handleSelect(r.href)}>
                      <FolderKanban className="h-4 w-4 shrink-0" />
                      <span>{r.label}</span>
                      {r.sublabel && <span className="text-muted-foreground text-xs ml-1">— {r.sublabel}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="text-muted-foreground hover:text-foreground"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Org Switcher */}
        {organizations.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <Building2 className="mr-2 h-4 w-4" />
                {currentOrg?.name}
                <ChevronDown className="ml-2 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Switch Organization</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {organizations.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => switchOrg(org.id)}
                  className={org.id === currentOrg?.id ? 'bg-accent' : ''}
                >
                  {org.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatar_url || ''} alt={user?.full_name || ''} />
                <AvatarFallback className="bg-blue-600 text-white text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{user?.full_name || 'User'}</span>
                <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
