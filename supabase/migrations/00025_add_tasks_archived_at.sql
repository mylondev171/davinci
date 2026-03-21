ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tasks_archived_at ON public.tasks(archived_at)
  WHERE archived_at IS NULL;
