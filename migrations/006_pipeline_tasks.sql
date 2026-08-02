CREATE TABLE IF NOT EXISTS pipeline_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  service_slug TEXT NOT NULL,
  service_name TEXT NOT NULL,
  deliverable_type TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  company TEXT,
  task_brief TEXT NOT NULL,
  assigned_roles TEXT[] NOT NULL DEFAULT '{}',
  deadline TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_tasks_pending ON pipeline_tasks (status, created_at) WHERE status = 'pending';
