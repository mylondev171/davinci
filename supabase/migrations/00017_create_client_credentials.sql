CREATE TABLE IF NOT EXISTS public.client_credentials (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id        UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_by       UUID NOT NULL REFERENCES auth.users(id),
  platform_name    TEXT NOT NULL,
  platform_url     TEXT,
  username         TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,
  poc              TEXT,
  scope            TEXT NOT NULL DEFAULT 'organization' CHECK (scope IN ('organization', 'personal')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_credentials_org ON public.client_credentials(org_id);
CREATE INDEX IF NOT EXISTS idx_client_credentials_client ON public.client_credentials(client_id);

ALTER TABLE public.client_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view client_credentials"
  ON public.client_credentials FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Org members can insert client_credentials"
  ON public.client_credentials FOR INSERT
  WITH CHECK (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Org members can update client_credentials"
  ON public.client_credentials FOR UPDATE
  USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Admins can delete client_credentials"
  ON public.client_credentials FOR DELETE
  USING (get_user_role(org_id) IN ('owner', 'admin'));
