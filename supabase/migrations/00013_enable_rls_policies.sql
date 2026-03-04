-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- ORGANIZATIONS
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Owners can update their organization"
  ON organizations FOR UPDATE
  USING (get_user_role(id) = 'owner');

-- PROFILES
CREATE POLICY "Users can view profiles in their orgs"
  ON profiles FOR SELECT
  USING (id = auth.uid() OR id IN (
    SELECT user_id FROM memberships WHERE org_id IN (SELECT get_user_org_ids())
  ));

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- MEMBERSHIPS
CREATE POLICY "Users can view memberships in their orgs"
  ON memberships FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can create initial membership"
  ON memberships FOR INSERT
  WITH CHECK (user_id = auth.uid() OR get_user_role(org_id) IN ('owner', 'admin'));

CREATE POLICY "Admins can update memberships"
  ON memberships FOR UPDATE
  USING (get_user_role(org_id) IN ('owner', 'admin'));

CREATE POLICY "Admins can delete memberships"
  ON memberships FOR DELETE
  USING (get_user_role(org_id) IN ('owner', 'admin'));

-- Standard org-scoped policies (for clients, contacts, notes, activities, projects, tasks, milestones, email_threads, documents)
-- Using a DO block to reduce repetition
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['clients', 'contacts', 'notes', 'activities', 'projects', 'tasks', 'milestones', 'email_threads', 'documents'])
  LOOP
    EXECUTE format('
      CREATE POLICY "Org members can view %1$s"
        ON %1$s FOR SELECT
        USING (org_id IN (SELECT get_user_org_ids()));

      CREATE POLICY "Org members can insert %1$s"
        ON %1$s FOR INSERT
        WITH CHECK (org_id IN (SELECT get_user_org_ids()));

      CREATE POLICY "Org members can update %1$s"
        ON %1$s FOR UPDATE
        USING (org_id IN (SELECT get_user_org_ids()));

      CREATE POLICY "Admins can delete %1$s"
        ON %1$s FOR DELETE
        USING (get_user_role(org_id) IN (''owner'', ''admin''));
    ', tbl);
  END LOOP;
END $$;

-- PROJECT_MEMBERS
CREATE POLICY "Org members can view project members"
  ON project_members FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE org_id IN (SELECT get_user_org_ids())));

CREATE POLICY "Org members can manage project members"
  ON project_members FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE org_id IN (SELECT get_user_org_ids())));

-- INTEGRATION_CREDENTIALS (admins only)
CREATE POLICY "Admins can view integration credentials"
  ON integration_credentials FOR SELECT
  USING (get_user_role(org_id) IN ('owner', 'admin'));

CREATE POLICY "Admins can insert integration credentials"
  ON integration_credentials FOR INSERT
  WITH CHECK (get_user_role(org_id) IN ('owner', 'admin'));

CREATE POLICY "Admins can update integration credentials"
  ON integration_credentials FOR UPDATE
  USING (get_user_role(org_id) IN ('owner', 'admin'));

CREATE POLICY "Admins can delete integration credentials"
  ON integration_credentials FOR DELETE
  USING (get_user_role(org_id) IN ('owner', 'admin'));

-- CHAT_SESSIONS (own only)
CREATE POLICY "Users can manage own chat sessions"
  ON chat_sessions FOR ALL
  USING (user_id = auth.uid() AND org_id IN (SELECT get_user_org_ids()));
