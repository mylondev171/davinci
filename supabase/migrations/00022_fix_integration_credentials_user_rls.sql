-- The existing admin-only SELECT policy on integration_credentials blocks regular
-- members from reading their own per-user Google OAuth row on the integrations page.
-- Add a policy that allows users to read credentials tied to their own user_id.

CREATE POLICY "Users can view own integration credentials"
  ON public.integration_credentials FOR SELECT
  USING (user_id = auth.uid());

-- Allow regular members to insert their own per-user credentials (Google OAuth rows).
-- The admin policy covers org-level (user_id IS NULL) inserts; this covers user-scoped rows.
CREATE POLICY "Users can insert own integration credentials"
  ON public.integration_credentials FOR INSERT
  WITH CHECK (user_id = auth.uid() AND org_id IN (SELECT get_user_org_ids()));

-- Allow users to update their own credential rows (e.g. token refresh).
CREATE POLICY "Users can update own integration credentials"
  ON public.integration_credentials FOR UPDATE
  USING (user_id = auth.uid());
