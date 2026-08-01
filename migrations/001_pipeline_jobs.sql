CREATE TABLE IF NOT EXISTS pipeline_jobs (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  service_slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error TEXT
);
CREATE INDEX IF NOT EXISTS pipeline_jobs_pending_idx ON pipeline_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS pipeline_jobs_client_idx ON pipeline_jobs (client_id, created_at DESC);
