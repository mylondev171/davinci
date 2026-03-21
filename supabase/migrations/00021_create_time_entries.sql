CREATE TABLE public.time_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  task_id     UUID NOT NULL REFERENCES public.tasks(id) ON DELETE RESTRICT,
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  date        DATE NOT NULL,
  hours       DECIMAL(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  note        TEXT,
  billable    BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_entries_org_id ON public.time_entries(org_id);
CREATE INDEX idx_time_entries_task_id ON public.time_entries(task_id);
CREATE INDEX idx_time_entries_project_id ON public.time_entries(project_id);
CREATE INDEX idx_time_entries_user_id ON public.time_entries(user_id);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- All org members can read time entries
CREATE POLICY "Org members can view time_entries"
  ON public.time_entries FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));

-- Org members can only log time as themselves
CREATE POLICY "Org members can insert time_entries"
  ON public.time_entries FOR INSERT
  WITH CHECK (
    org_id IN (SELECT get_user_org_ids())
    AND user_id = auth.uid()
  );

-- Members can edit their own entries; admins/owners can edit any
CREATE POLICY "Members can update time_entries"
  ON public.time_entries FOR UPDATE
  USING (
    org_id IN (SELECT get_user_org_ids())
    AND (user_id = auth.uid() OR get_user_role(org_id) IN ('owner', 'admin'))
  );

-- Members can delete their own entries; admins/owners can delete any
CREATE POLICY "Members can delete time_entries"
  ON public.time_entries FOR DELETE
  USING (
    org_id IN (SELECT get_user_org_ids())
    AND (user_id = auth.uid() OR get_user_role(org_id) IN ('owner', 'admin'))
  );
