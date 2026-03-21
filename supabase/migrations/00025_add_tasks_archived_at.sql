ALTER TABLE public.tasks
  ADD COLUMN archived_at TIMESTAMPTZ;

CREATE INDEX idx_tasks_archived_at ON public.tasks(archived_at)
  WHERE archived_at IS NULL;
