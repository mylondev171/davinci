import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const statusColors: Record<string, string> = {
  // Client statuses
  lead: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  prospect: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  active: 'bg-green-500/10 text-green-500 border-green-500/20',
  on_hold: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  churned: 'bg-red-500/10 text-red-500 border-red-500/20',
  // Project statuses
  planning: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  completed: 'bg-green-500/10 text-green-500 border-green-500/20',
  cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
  // Task statuses
  todo: 'bg-slate-500/10 text-muted-foreground border-slate-500/20',
  in_progress: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  in_review: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  done: 'bg-green-500/10 text-green-500 border-green-500/20',
  blocked: 'bg-red-500/10 text-red-500 border-red-500/20',
  // Priorities
  low: 'bg-slate-500/10 text-muted-foreground border-slate-500/20',
  medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  high: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  urgent: 'bg-red-500/10 text-red-500 border-red-500/20',
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = status.replace(/_/g, ' ')
  return (
    <Badge
      variant="outline"
      className={cn(
        'capitalize',
        statusColors[status] || 'bg-slate-500/10 text-muted-foreground border-slate-500/20',
        className
      )}
    >
      {label}
    </Badge>
  )
}
