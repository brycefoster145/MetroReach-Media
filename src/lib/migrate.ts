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

const sql = postgres(url, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 10,
  ssl: "require",
});

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

  await sql.end();
  console.log("Migration complete.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
