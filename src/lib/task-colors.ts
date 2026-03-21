export const TASK_STATUS_COLORS: Record<string, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  in_review: 'bg-purple-500',
  done: 'bg-green-500',
  blocked: 'bg-red-500',
}

export function statusDot(status: string) {
  return TASK_STATUS_COLORS[status] ?? 'bg-slate-400'
}
