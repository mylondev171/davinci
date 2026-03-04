CREATE TABLE activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id     UUID REFERENCES clients(id) ON DELETE SET NULL,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  task_id       UUID REFERENCES tasks(id) ON DELETE SET NULL,
  actor_id      UUID REFERENCES auth.users(id),
  activity_type TEXT NOT NULL
                  CHECK (activity_type IN (
                    'client_created', 'client_updated', 'status_changed',
                    'email_received', 'email_sent',
                    'note_added', 'document_linked',
                    'project_created', 'task_created', 'task_completed', 'task_status_changed',
                    'meeting_scheduled', 'call_logged',
                    'ai_insight'
                  )),
  title         TEXT NOT NULL,
  description   TEXT,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activities_org_id ON activities(org_id);
CREATE INDEX idx_activities_client_id ON activities(client_id, created_at DESC);
CREATE INDEX idx_activities_created_at ON activities(org_id, created_at DESC);
