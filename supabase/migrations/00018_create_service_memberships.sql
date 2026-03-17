CREATE TABLE IF NOT EXISTS public.service_memberships (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_name          TEXT NOT NULL,
  service_url           TEXT,
  membership_level      TEXT,
  cost                  NUMERIC,
  billing_cycle         TEXT CHECK (billing_cycle IN ('monthly', 'yearly')),
  flagged_for_removal   BOOLEAN NOT NULL DEFAULT false,
  flagged_at            TIMESTAMPTZ,
  last_reminder_sent_at TIMESTAMPTZ,
  created_by            UUID NOT NULL REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_memberships_org ON public.service_memberships(org_id);

ALTER TABLE public.service_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view service_memberships"
  ON public.service_memberships FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Org members can insert service_memberships"
  ON public.service_memberships FOR INSERT
  WITH CHECK (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Org members can update service_memberships"
  ON public.service_memberships FOR UPDATE
  USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Admins can delete service_memberships"
  ON public.service_memberships FOR DELETE
  USING (get_user_role(org_id) IN ('owner', 'admin'));
