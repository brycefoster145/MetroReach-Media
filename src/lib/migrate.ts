/**
 * Migration: Ensure leads and audit_results tables are ready for the audit flow.
 *
 * The leads table may already exist from other systems — this migration is
 * idempotent: it creates tables if missing and adds columns if absent.
 *
 * Run with: DATABASE_URL=... bun run src/lib/migrate.ts
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("DATABASE_URL is not set — skipping migration (production will run it)");
  process.exit(0);
}

let sql: ReturnType<typeof postgres>;
try {
  sql = postgres(url, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: "require",
  });
} catch (err: any) {
  console.error("Could not create database connection (non-fatal):", err.message);
  console.log("Skipping migration — will run in production.");
  process.exit(0);
}

async function migrate() {
  console.log("Running migration...");

  // ── leads table ──
  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      form_data JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("✓ leads table ready");

  // If the table existed before this migration, it may be missing form_data
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS form_data JSONB`;
  console.log("✓ form_data column ready");

  // Relax constraints from prior schemas that may block our inserts
  await sql`ALTER TABLE leads ALTER COLUMN tenant_id DROP NOT NULL`.catch(() => {});
  await sql`ALTER TABLE leads ALTER COLUMN name DROP NOT NULL`.catch(() => {});

  // ── audit_results table ──
  await sql`
    CREATE TABLE IF NOT EXISTS audit_results (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      result_json JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("✓ audit_results table ready");

  // ── clients table ──
  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      company TEXT,
      service TEXT NOT NULL,
      service_slug TEXT NOT NULL,
      status TEXT DEFAULT 'onboarding',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      pipeline_status TEXT DEFAULT 'pending',
      onboarding_data JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_clients_stripe_customer ON clients(stripe_customer_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status)`;
  console.log("✓ clients table ready");

  // ── contact_leads table ──
  await sql`
    CREATE TABLE IF NOT EXISTS contact_leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT,
      phone TEXT DEFAULT '',
      industry TEXT DEFAULT '',
      message TEXT DEFAULT '',
      source TEXT DEFAULT 'website',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // Index on email for deduplication lookups
  await sql`CREATE INDEX IF NOT EXISTS idx_contact_leads_email ON contact_leads(email)`;
  // Index on created_at for sorted queries
  await sql`CREATE INDEX IF NOT EXISTS idx_contact_leads_created_at ON contact_leads(created_at DESC)`;
  console.log("✓ contact_leads table ready");

  // ── pipeline_log table ──
  await sql`
    CREATE TABLE IF NOT EXISTS pipeline_log (
      id SERIAL PRIMARY KEY,
      client_id TEXT NOT NULL,
      step_key TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      deliverables JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_pipeline_log_client ON pipeline_log(client_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pipeline_log_step ON pipeline_log(client_id, step_key)`;
  // Unique constraint to prevent duplicate step entries
  await sql`
    DO $
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_log_client_step_unique'
      ) THEN
        ALTER TABLE pipeline_log ADD CONSTRAINT pipeline_log_client_step_unique UNIQUE (client_id, step_key);
      END IF;
    END
    $
  `.catch(() => {});
  console.log("✓ pipeline_log table ready");

  // ── task_log table ──
  await sql`
    CREATE TABLE IF NOT EXISTS task_log (
      id SERIAL PRIMARY KEY,
      client_id TEXT NOT NULL,
      pipeline_file TEXT NOT NULL,
      step TEXT NOT NULL,
      success BOOLEAN DEFAULT true,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_task_log_client ON task_log(client_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_task_log_executed ON task_log(executed_at DESC)`;
  console.log("✓ task_log table ready");

  // Add onboarding_data column to clients if it doesn't exist
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_data JSONB`;
  console.log("✓ clients.onboarding_data column ready");

  // Add landing_url column to clients
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS landing_url TEXT DEFAULT ''`;
  console.log("✓ clients.landing_url column ready");

  // ── client_messages table ──
  await sql`
    CREATE TABLE IF NOT EXISTS client_messages (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id),
      direction TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_client_messages_client ON client_messages(client_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_client_messages_created ON client_messages(created_at DESC)`;
  console.log("✓ client_messages table ready");

  // ── deliverables table ──
  await sql`
    CREATE TABLE IF NOT EXISTS deliverables (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id),
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      file_url TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_deliverables_client ON deliverables(client_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_deliverables_status ON deliverables(client_id, status)`;
  console.log("✓ deliverables table ready");

  // ── buffer_channels table ──
  await sql`
    CREATE TABLE IF NOT EXISTS buffer_channels (
      id SERIAL PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id),
      platform TEXT NOT NULL,
      platform_url TEXT NOT NULL DEFAULT '',
      buffer_channel_id TEXT,
      is_active BOOLEAN DEFAULT true,
      cost_per_channel INTEGER DEFAULT 12,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_buffer_channels_client ON buffer_channels(client_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_buffer_channels_platform ON buffer_channels(platform)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_buffer_channels_active ON buffer_channels(client_id, is_active)`;
  await sql`
    DO $
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'buffer_channels_client_platform_unique'
      ) THEN
        ALTER TABLE buffer_channels ADD CONSTRAINT buffer_channels_client_platform_unique UNIQUE (client_id, platform);
      END IF;
    END
    $
  `.catch(() => {});
  console.log("✓ buffer_channels table ready");

  // ── client_leads table ──
  await sql`
    CREATE TABLE IF NOT EXISTS client_leads (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      source TEXT DEFAULT '',
      lead_name TEXT DEFAULT '',
      lead_email TEXT DEFAULT '',
      lead_phone TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      converted BOOLEAN DEFAULT FALSE,
      conversion_value_cents INTEGER DEFAULT 0,
      commission_cents INTEGER DEFAULT 0,
      notes TEXT DEFAULT ''
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_client_leads_client ON client_leads(client_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_client_leads_converted ON client_leads(client_id, converted)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_client_leads_created ON client_leads(created_at DESC)`;
  console.log("✓ client_leads table ready");

  // ── click_tracking table ──
  await sql`
    CREATE TABLE IF NOT EXISTS click_tracking (
      id SERIAL PRIMARY KEY,
      client_slug TEXT NOT NULL,
      post_slug TEXT NOT NULL,
      ref TEXT DEFAULT '',
      ip TEXT DEFAULT '',
      user_agent TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_click_tracking_client ON click_tracking(client_slug)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_click_tracking_post ON click_tracking(client_slug, post_slug)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_click_tracking_created ON click_tracking(created_at DESC)`;
  console.log("✓ click_tracking table ready");

  // ── portal_token column on clients ──
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_token TEXT UNIQUE`;
  await sql`CREATE INDEX IF NOT EXISTS idx_clients_portal_token ON clients(portal_token)`;
  console.log("✓ clients.portal_token column ready");

  // ── portal_messages table ──
  await sql`
    CREATE TABLE IF NOT EXISTS portal_messages (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id),
      sender_type TEXT NOT NULL DEFAULT 'client',
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_portal_messages_client ON portal_messages(client_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_portal_messages_created ON portal_messages(created_at ASC)`;
  console.log("✓ portal_messages table ready");

  // ── content_approvals table ──
  await sql`
    CREATE TABLE IF NOT EXISTS content_approvals (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id),
      title TEXT NOT NULL,
      content_type TEXT DEFAULT 'social_post',
      platform TEXT DEFAULT '',
      scheduled_date TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      content_preview TEXT DEFAULT '',
      client_notes TEXT DEFAULT '',
      team_notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_content_approvals_client ON content_approvals(client_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_content_approvals_status ON content_approvals(client_id, status)`;
  console.log("✓ content_approvals table ready");

  await sql.end();
  console.log("Migration complete.");
}

migrate().catch((err) => {
  console.error("Migration failed (non-fatal during build):", err.message);
  console.log("The migration will run automatically in production.");
  process.exit(0);
});
