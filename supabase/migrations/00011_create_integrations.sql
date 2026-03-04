CREATE TABLE integration_credentials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL
                    CHECK (provider IN ('google', 'semrush', 'reportgarden')),
  access_token    TEXT,
  refresh_token   TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes          TEXT[],
  api_key         TEXT,
  account_email   TEXT,
  connected_by    UUID REFERENCES auth.users(id),
  is_active       BOOLEAN DEFAULT true,
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, provider)
);
CREATE INDEX idx_integration_credentials_org ON integration_credentials(org_id);

CREATE TABLE email_threads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
  gmail_thread_id TEXT NOT NULL,
  gmail_message_ids TEXT[] DEFAULT '{}',
  subject         TEXT,
  snippet         TEXT,
  participants    JSONB,
  last_message_at TIMESTAMPTZ,
  message_count   INTEGER DEFAULT 0,
  labels          TEXT[] DEFAULT '{}',
  is_read         BOOLEAN DEFAULT true,
  raw_messages    JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, gmail_thread_id)
);
CREATE INDEX idx_email_threads_org ON email_threads(org_id);
CREATE INDEX idx_email_threads_client ON email_threads(client_id);

CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  drive_file_id   TEXT NOT NULL,
  name            TEXT NOT NULL,
  mime_type       TEXT,
  web_view_link   TEXT,
  thumbnail_link  TEXT,
  last_modified   TIMESTAMPTZ,
  linked_by       UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, drive_file_id)
);
CREATE INDEX idx_documents_client ON documents(client_id);
