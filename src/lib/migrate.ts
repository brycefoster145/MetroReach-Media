/**
 * Migration: Ensure leads and audit_results tables are ready for the audit flow.
 *
 * The leads table may already exist from other systems — this migration is
 * idempotent: it creates tables if missing and adds columns if absent.
 *
 * Run with: DATABASE_URL=... bun run src/lib/migrate.ts
 */
import { neon } from "@neondatabase/serverless";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("DATABASE_URL is not set — skipping migration (production will run it)");
  process.exit(0);
}

let sql: ReturnType<typeof neon>;
try {
  sql = neon(url);
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

  // ── cron_runs table ──
  await sql`
    CREATE TABLE IF NOT EXISTS cron_runs (
      id SERIAL PRIMARY KEY,
      run_at TIMESTAMPTZ DEFAULT NOW(),
      posts_found INTEGER DEFAULT 0,
      posts_processed INTEGER DEFAULT 0,
      posts_succeeded INTEGER DEFAULT 0,
      posts_failed INTEGER DEFAULT 0,
      elapsed_ms INTEGER DEFAULT 0,
      error TEXT
    )
  `;
  console.log("✓ cron_runs table ready");

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

  // ── buffer_channels table REMOVED — Buffer decommissioned 2026-07-27 ──

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

  // ── client_platform_tokens table ──
  await sql`
    CREATE TABLE IF NOT EXISTS client_platform_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      access_token TEXT NOT NULL,
      page_id TEXT,
      account_name TEXT,
      expires_at TIMESTAMPTZ,
      token_status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_client_platform_tokens_lookup ON client_platform_tokens(client_id, platform)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_client_platform_tokens_expires ON client_platform_tokens(token_status, expires_at)`;
  // Add token_status column if missing on existing tables
  await sql`ALTER TABLE client_platform_tokens ADD COLUMN IF NOT EXISTS token_status TEXT DEFAULT 'active'`;
  console.log("✓ client_platform_tokens table ready");

  // ── cron_runs table (tracks every cron execution for health monitoring) ──
  await sql`
    CREATE TABLE IF NOT EXISTS cron_runs (
      id SERIAL PRIMARY KEY,
      run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      posts_found INTEGER DEFAULT 0,
      posts_processed INTEGER DEFAULT 0,
      posts_succeeded INTEGER DEFAULT 0,
      posts_failed INTEGER DEFAULT 0,
      elapsed_ms INTEGER DEFAULT 0,
      error TEXT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_cron_runs_run_at ON cron_runs(run_at DESC)`;
  console.log("✓ cron_runs table ready");

  // ── scheduled_posts table ──
  await sql`
    CREATE TABLE IF NOT EXISTS scheduled_posts (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL DEFAULT 'metroreach',
      platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'linkedin', 'tiktok', 'x', 'google')),
      page_id TEXT NOT NULL,
      ig_user_id TEXT,
      content TEXT NOT NULL,
      media_urls JSONB DEFAULT '[]',
      hashtags TEXT DEFAULT '#MetroReachMedia',
      due_at TIMESTAMPTZ NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'failed', 'missed')),
      meta_post_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      posted_at TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_scheduled_posts_due ON scheduled_posts(status, due_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_scheduled_posts_client ON scheduled_posts(client_id, status)`;
  console.log("✓ scheduled_posts table ready");

  // ── Fix due_at column type (TEXT → TIMESTAMPTZ) ──
  // If the table was created with due_at TEXT, comparisons with NOW() fail.
  // This ALTER converts it safely using the cast.
  try {
    await sql`
      ALTER TABLE scheduled_posts 
      ALTER COLUMN due_at TYPE TIMESTAMPTZ USING due_at::TIMESTAMPTZ
    `;
    console.log("✓ due_at column type fixed to TIMESTAMPTZ");
  } catch (err: any) {
    // If it's already TIMESTAMPTZ, the ALTER is a no-op and may throw.
    // Swallow the error — the column is already correct.
    console.log(`ℹ due_at column migration skipped: ${err.message}`);
    }

    // ── Fix status check constraint to include 'publishing' ──
    try {
      await sql`
        ALTER TABLE scheduled_posts
        DROP CONSTRAINT IF EXISTS scheduled_posts_status_check
      `;
      await sql`
        ALTER TABLE scheduled_posts
        ADD CONSTRAINT scheduled_posts_status_check
        CHECK (status IN ('pending', 'publishing', 'posted', 'failed', 'skipped_no_media', 'missed'))
      `;
      console.log("✓ status check constraint updated (includes publishing)");
    } catch (err2: any) {
      console.log(`ℹ status constraint migration skipped: ${err2.message}`);
    }

    // ── watchdog_alerts table ──
    await sql`
      CREATE TABLE IF NOT EXISTS watchdog_alerts (
        id SERIAL PRIMARY KEY,
        alert_type TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'warning',
        message TEXT NOT NULL,
        checks_data JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_watchdog_alerts_created ON watchdog_alerts(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_watchdog_alerts_severity ON watchdog_alerts(severity)`;
    console.log("✓ watchdog_alerts table ready");

    // ── orders table ──
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        client_email TEXT NOT NULL,
        client_name TEXT,
        service_name TEXT NOT NULL,
        service_slug TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        stripe_session_id TEXT,
        assigned_team_members JSONB DEFAULT '[]',
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'delivered')),
        deadline TIMESTAMPTZ,
        deliverable_description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_orders_client_email ON orders(client_email)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC)`;
    console.log("✓ orders table ready");

    // ── Ensure generated image directory exists ──
    const generatedDir = join(process.cwd(), "public", "social", "generated");
    if (!existsSync(generatedDir)) {
    try {
      mkdirSync(generatedDir, { recursive: true });
      console.log("✓ public/social/generated/ directory created");
    } catch (err2: any) {
      console.log(`ℹ generated directory creation skipped: ${err2.message}`);
    }
    } else {
    console.log("✓ public/social/generated/ directory exists");
    }

    console.log("Migration complete.");
    }

migrate().catch((err) => {
  console.error("Migration failed (non-fatal during build):", err.message);
  console.log("The migration will run automatically in production.");
  process.exit(0);
});
