'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { TimeEntryForm } from './time-entry-form'
import { Play, Square } from 'lucide-react'
import { toast } from 'sonner'

const STORAGE_KEY = 'active_timer'
const STALE_MS = 12 * 60 * 60 * 1000

interface TimerState { taskId: string; taskTitle: string; startedAt: string }

function readTimer(): TimerState | null {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') } catch { return null }
}
function writeTimer(t: TimerState | null) {
  if (t) localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
  else localStorage.removeItem(STORAGE_KEY)
}
function elapsedHours(startedAt: string): number {
  const ms = Date.now() - new Date(startedAt).getTime()
  return Math.max(0.01, Math.ceil(ms / 36000) / 100)
}
function formatElapsed(startedAt: string): string {
  const ms = Math.max(0, Date.now() - new Date(startedAt).getTime())
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`
}

interface Props { taskId: string; taskTitle: string; onSuccess?: () => void }

export function TimerWidget({ taskId, taskTitle, onSuccess }: Props) {
  const [active, setActive] = useState<TimerState | null>(null)
  const [elapsed, setElapsed] = useState('')
  const [saveOpen, setSaveOpen] = useState(false)
  const [prefillHours, setPrefillHours] = useState<number | undefined>()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const syncFromStorage = useCallback(() => {
    const t = readTimer()
    if (!t) { setActive(null); return }
    const age = Date.now() - new Date(t.startedAt).getTime()
    if (age > STALE_MS) { writeTimer(null); setActive(null); return }
    if (t.taskId === taskId) {
      setActive(t)
      setElapsed(formatElapsed(t.startedAt))
      if (age > 0) toast(`Resuming timer from ${formatElapsed(t.startedAt)} ago`, { duration: 3000 })
    } else {
      setActive(null)
    }
  }, [taskId])

  useEffect(() => {
    syncFromStorage()
    const handler = () => syncFromStorage()
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [syncFromStorage])

  useEffect(() => {
    if (active && active.taskId === taskId) {
      intervalRef.current = setInterval(() => setElapsed(formatElapsed(active.startedAt)), 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [active, taskId])

  const handleStart = () => {
    const current = readTimer()
    if (current && current.taskId !== taskId) {
      if (!window.confirm(`Stop timing "${current.taskTitle}" (time not saved) and start "${taskTitle}"?`)) return
    }
    const t: TimerState = { taskId, taskTitle, startedAt: new Date().toISOString() }
    writeTimer(t)
    setActive(t)
    setElapsed('0:00')
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
  }

  const handleStop = () => {
    if (!active) return
    const h = elapsedHours(active.startedAt)
    setPrefillHours(h)
    writeTimer(null)
    setActive(null)
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
    setSaveOpen(true)
  }

  const isRunning = active?.taskId === taskId

  return (
    <span className="inline-flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
      {isRunning && <span className="text-xs text-green-400 tabular-nums min-w-[3.5rem]">{elapsed}</span>}
      <Button
        variant="ghost" size="sm"
        className={`h-6 px-2 text-xs ${isRunning ? 'text-green-400 hover:text-red-400' : 'text-muted-foreground'}`}
        onClick={isRunning ? handleStop : handleStart}
        title={isRunning ? 'Stop timer' : 'Start timer'}
      >
        {isRunning ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      </Button>
      <TimeEntryForm
        taskId={taskId} taskTitle={taskTitle}
        prefillHours={prefillHours}
        open={saveOpen} onOpenChange={setSaveOpen}
        onSuccess={onSuccess}
      />
    </span>
  )
}
