-- Buffer client channel lifecycle. IDs remain NULL until manual Buffer OAuth linking.
CREATE TABLE IF NOT EXISTS client_channels (
  id TEXT PRIMARY KEY DEFAULT ('channel-' || gen_random_uuid()::text),
  stripe_customer_id TEXT,
  customer_email TEXT NOT NULL,
  buffer_channel_id TEXT,
  platform TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending_manual',
  CONSTRAINT client_channels_status_check CHECK (status IN ('pending_manual', 'active', 'cancelled', 'agency_reference')),
  CONSTRAINT client_channels_platform_check CHECK (platform IN ('instagram', 'facebook', 'linkedin_company', 'tiktok', 'youtube', 'x'))
);
CREATE INDEX IF NOT EXISTS idx_client_channels_customer ON client_channels(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_client_channels_status ON client_channels(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_channels_active_identity
  ON client_channels(stripe_customer_id, customer_email, platform)
  WHERE status <> 'cancelled';

-- Existing agency channels are references only and can never be used for clients.
INSERT INTO client_channels (id, customer_email, buffer_channel_id, platform, status)
VALUES
 ('agency-reference-instagram', 'internal@metroreachagency.com', '6a6156cee2638b94d7b9abf0', 'instagram', 'agency_reference'),
 ('agency-reference-facebook', 'internal@metroreachagency.com', '6a615653e2638b94d7b9aa6f', 'facebook', 'agency_reference')
ON CONFLICT (id) DO NOTHING;
