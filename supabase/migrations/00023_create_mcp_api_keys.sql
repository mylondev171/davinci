CREATE TABLE public.mcp_api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key_hash     TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL DEFAULT 'Coworker AI',
  created_by   UUID NOT NULL REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  is_active    BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_mcp_api_keys_org  ON public.mcp_api_keys(org_id);
CREATE INDEX idx_mcp_api_keys_hash ON public.mcp_api_keys(key_hash);

ALTER TABLE public.mcp_api_keys ENABLE ROW LEVEL SECURITY;

-- Only admins/owners can manage keys through the settings UI.
-- The /api/mcp endpoint uses the admin client and bypasses RLS entirely.
CREATE POLICY "Admins can manage mcp_api_keys"
  ON public.mcp_api_keys FOR ALL
  USING (get_user_role(org_id) IN ('owner', 'admin'));
