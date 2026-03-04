-- Add 'owner' to the org_invitations role constraint
-- (Table already exists from initial setup; this migration updates the constraint)
ALTER TABLE org_invitations DROP CONSTRAINT IF EXISTS org_invitations_role_check;
ALTER TABLE org_invitations ADD CONSTRAINT org_invitations_role_check CHECK (role IN ('owner', 'admin', 'member'));
