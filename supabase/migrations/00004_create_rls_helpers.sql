-- Returns the org_ids the current user belongs to
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT org_id FROM memberships WHERE user_id = auth.uid();
$$;

-- Returns the user's role in a specific org
CREATE OR REPLACE FUNCTION get_user_role(p_org_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM memberships WHERE user_id = auth.uid() AND org_id = p_org_id;
$$;
