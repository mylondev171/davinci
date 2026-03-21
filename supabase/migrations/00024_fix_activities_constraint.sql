-- Fix missing activity types that are already used in code but missing from the constraint.
-- project_updated is used by /api/projects/[projectId] PUT route.
ALTER TABLE public.activities
  DROP CONSTRAINT IF EXISTS activities_activity_type_check;

ALTER TABLE public.activities
  ADD CONSTRAINT activities_activity_type_check
  CHECK (activity_type IN (
    'client_created', 'client_updated', 'status_changed',
    'email_received', 'email_sent',
    'note_added', 'document_linked',
    'project_created', 'project_updated',
    'task_created', 'task_completed', 'task_status_changed',
    'meeting_scheduled', 'call_logged',
    'ai_insight'
  ));
