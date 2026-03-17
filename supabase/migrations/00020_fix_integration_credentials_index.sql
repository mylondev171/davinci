-- Add a partial unique index for org-level credentials (user_id IS NULL).
-- This enforces one row per provider per org for API keys (claude, gemini, semrush, reportgarden).
-- Per-user credentials (user_id IS NOT NULL) are covered by the existing unique constraint.
CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_credentials_org_provider_null
  ON public.integration_credentials (org_id, provider)
  WHERE user_id IS NULL;
