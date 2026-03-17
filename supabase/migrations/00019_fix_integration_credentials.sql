-- Add user_id column (for per-user Google connections, distinct from org-level connected_by)
ALTER TABLE public.integration_credentials
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_integration_credentials_user ON public.integration_credentials(user_id);

-- Drop the existing provider constraint and re-add it with claude + gemini support
ALTER TABLE public.integration_credentials
  DROP CONSTRAINT IF EXISTS integration_credentials_provider_check;

ALTER TABLE public.integration_credentials
  ADD CONSTRAINT integration_credentials_provider_check
  CHECK (provider IN ('google', 'semrush', 'reportgarden', 'claude', 'gemini'));

-- The unique constraint was (org_id, provider) which prevents per-user Google rows.
-- Drop and replace with (org_id, provider, user_id) so each user can have their own Google connection.
ALTER TABLE public.integration_credentials
  DROP CONSTRAINT IF EXISTS integration_credentials_org_id_provider_key;

ALTER TABLE public.integration_credentials
  DROP CONSTRAINT IF EXISTS integration_credentials_org_provider_user_key;

ALTER TABLE public.integration_credentials
  ADD CONSTRAINT integration_credentials_org_provider_user_key
  UNIQUE (org_id, provider, user_id);
