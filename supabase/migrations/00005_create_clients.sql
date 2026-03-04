CREATE TABLE clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_name  TEXT NOT NULL,
  industry      TEXT,
  website       TEXT,
  status        TEXT NOT NULL DEFAULT 'lead'
                  CHECK (status IN ('lead', 'prospect', 'active', 'on_hold', 'churned')),
  pipeline_stage TEXT DEFAULT 'new'
                  CHECK (pipeline_stage IN ('new', 'contacted', 'proposal', 'negotiation', 'won', 'lost')),
  logo_url      TEXT,
  address       JSONB,
  custom_fields JSONB DEFAULT '{}',
  notes_summary TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clients_org_id ON clients(org_id);
CREATE INDEX idx_clients_status ON clients(org_id, status);
CREATE INDEX idx_clients_company_name ON clients(org_id, company_name);
