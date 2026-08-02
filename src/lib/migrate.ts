/**
 * Migration: Ensure all tables and columns are ready.
 *
 * Idempotent — every statement uses CREATE TABLE IF NOT EXISTS
 * or ADD COLUMN IF NOT EXISTS. Safe to call on every deploy / cold start.
 *
 * Run directly:   DATABASE_URL=... bun run src/lib/migrate.ts
 * Imported:       import { migrate } from "~/lib/migrate"; await migrate();
 */
import { neon } from "@neondatabase/serverless";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export async function migrate(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[migration] DATABASE_URL not set — skipping");
    return;
  }

  let sql: ReturnType<typeof neon>;
  try {
    sql = neon(url);
  } catch (err: any) {
    console.error("[migration] Could not create database connection:", err.message);
    return;
  }

  console.log("[migration] Running...");

  // ── leads table ──
  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      form_data JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("[migration] ✓ leads table ready");

  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS form_data JSONB`;
  console.log("[migration] ✓ form_data column ready");

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
  console.log("[migration] ✓ audit_results table ready");

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
  console.log("[migration] ✓ clients table ready");

  // ── webhook_events table ──
  // Idempotency ledger for inbound webhooks (primarily Stripe). Each event id
  // is claimed here exactly once so duplicate deliveries (Stripe retries,
  // serverless cold-start timeouts, double-sends) can never create duplicate
  // or inconsistent client records.
  await sql`
    CREATE TABLE IF NOT EXISTS webhook_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      processed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("[migration] ✓ webhook_events table ready");

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
  await sql`CREATE INDEX IF NOT EXISTS idx_contact_leads_email ON contact_leads(email)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_contact_leads_created_at ON contact_leads(created_at DESC)`;
  console.log("[migration] ✓ contact_leads table ready");

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
  // Backfill: add elapsed_ms column if table existed before this migration
  await sql`ALTER TABLE cron_runs ADD COLUMN IF NOT EXISTS elapsed_ms INTEGER DEFAULT 0`.catch(() => {});
  console.log("[migration] ✓ cron_runs table ready");

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
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_log_client_step_unique'
      ) THEN
        ALTER TABLE pipeline_log ADD CONSTRAINT pipeline_log_client_step_unique UNIQUE (client_id, step_key);
      END IF;
    END
    $$
  `.catch(() => {});
  console.log("[migration] ✓ pipeline_log table ready");

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
  console.log("[migration] ✓ task_log table ready");

  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_data JSONB`;
  console.log("[migration] ✓ clients.onboarding_data column ready");

  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS landing_url TEXT DEFAULT ''`;
  console.log("[migration] ✓ clients.landing_url column ready");

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
  console.log("[migration] ✓ client_messages table ready");

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
  console.log("[migration] ✓ deliverables table ready");

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
  console.log("[migration] ✓ client_leads table ready");

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
  console.log("[migration] ✓ click_tracking table ready");

  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_token TEXT UNIQUE`;
  await sql`CREATE INDEX IF NOT EXISTS idx_clients_portal_token ON clients(portal_token)`;
  console.log("[migration] ✓ clients.portal_token column ready");
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS password_hash TEXT`;
  console.log("[migration] ✓ clients.password_hash column ready");

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
  console.log("[migration] ✓ portal_messages table ready");

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
  console.log("[migration] ✓ content_approvals table ready");

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
  await sql`ALTER TABLE client_platform_tokens ADD COLUMN IF NOT EXISTS token_status TEXT DEFAULT 'active'`;
  await sql`ALTER TABLE client_platform_tokens ADD COLUMN IF NOT EXISTS refresh_token TEXT`;
  await sql`CREATE INDEX IF NOT EXISTS idx_client_platform_tokens_expires ON client_platform_tokens(token_status, expires_at)`;
  // Add unique constraint (idempotent — wrapped in DO block to skip if exists)
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_client_platform_page'
          AND conrelid = 'client_platform_tokens'::regclass
      ) THEN
        ALTER TABLE client_platform_tokens ADD CONSTRAINT uq_client_platform_page UNIQUE (client_id, platform, page_id);
      END IF;
    END $$;
  `.catch(() => {});
  console.log("[migration] ✓ client_platform_tokens table ready (incl. refresh_token + unique constraint)");

  // ── buffer_credentials table ──
  // Singleton row (id = 'default') holding the agency's Buffer OAuth access
  // token. Written by /api/portal/buffer-oauth-callback after a successful
  // OAuth flow; read by the Buffer MCP bridge (/api/mcp/buffer) when
  // BUFFER_ACCESS_TOKEN is not set in the environment.
  await sql`
    CREATE TABLE IF NOT EXISTS buffer_credentials (
      id TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      token_type TEXT DEFAULT 'Bearer',
      refresh_token TEXT,
      scope TEXT,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("[migration] ✓ buffer_credentials table ready");

  // ── cron_runs table (deduplicated from above — skipped if exists) ──

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
      hashtags TEXT,
      due_at TIMESTAMPTZ NOT NULL,
      status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'pending', 'publishing', 'posted', 'failed', 'missed', 'skipped_no_media')),
      meta_post_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      posted_at TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_scheduled_posts_due ON scheduled_posts(status, due_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_scheduled_posts_client ON scheduled_posts(client_id, status)`;
  console.log("[migration] ✓ scheduled_posts table ready");

  // ── C1: retry_count for failed post retry with exponential backoff ──
  await sql`ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0`;
  console.log("[migration] ✓ scheduled_posts.retry_count column ready");

  // ── C2: locked_at for atomic claim scheduler (prevents double-posts) ──
  await sql`ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ`;
  console.log("[migration] ✓ scheduled_posts.locked_at column ready");

  // ── C2b: error_message for publish failures (used by cron/publish + watchdog) ──
  await sql`ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS error_message TEXT`;
  console.log("[migration] ✓ scheduled_posts.error_message column ready");

  // ── Content pipeline: rejection tracking for the review→replace loop ──
  await sql`ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS rejection_count INTEGER DEFAULT 0`;
  await sql`ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS replaced_post_id TEXT`;
  await sql`ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS content_prompt TEXT`;
  console.log("[migration] ✓ scheduled_posts rejection_count, replaced_post_id, content_prompt columns ready");

  // ── C3: Expand status CHECK to include 'pending_review', 'draft', 'publishing' ──
  try {
    await sql`
      ALTER TABLE scheduled_posts
      DROP CONSTRAINT IF EXISTS scheduled_posts_status_check
    `.catch(() => {});
    await sql`
      ALTER TABLE scheduled_posts
      ADD CONSTRAINT scheduled_posts_status_check
      CHECK (status IN ('draft', 'pending_review', 'pending', 'publishing', 'posted', 'failed', 'skipped_no_media', 'missed'))
    `.catch(() => {});
    console.log("[migration] ✓ status CHECK constraint updated (includes draft, pending_review, publishing)");
  } catch (err: any) {
    console.log(`[migration] ℹ status CHECK migration skipped: ${err.message}`);
  }

  // ── UTM attribution: utm_link for click tracking redirects ──
  await sql`ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS utm_link TEXT`;
  console.log("[migration] ✓ scheduled_posts.utm_link column ready");

  // ── H1: Unique partial index — prevents duplicate slots ──
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_posts_slot
    ON scheduled_posts (client_id, platform, due_at)
    WHERE status = 'pending'
  `.catch(() => {});
  console.log("[migration] ✓ idx_scheduled_posts_slot unique index ready");

  // ── Fix due_at column type (TEXT → TIMESTAMPTZ) ──
  try {
    await sql`
      ALTER TABLE scheduled_posts
      ALTER COLUMN due_at TYPE TIMESTAMPTZ USING due_at::TIMESTAMPTZ
    `;
    console.log("[migration] ✓ due_at column type fixed to TIMESTAMPTZ");
  } catch (err: any) {
    console.log(`[migration] ℹ due_at column migration skipped: ${err.message}`);
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

    // ── PUBLISH SAFETY GUARD (004) ──
    // Watchdog-era DB cleanup + approval gate. Context: the custom publisher was
    // disabled (PR #118) after mass-posting; this is the safety prep before it
    // can be re-enabled. Buffer is the sole publishing layer; this schema remains only
    // `approved_at IS NOT NULL` (see COMMENT ON TABLE below).
    // ── 004a: Purge watchdog-era test posts (one-time cleanup; idempotent) ──
    // Stuck 'publishing' rows never finished (cron is the only 'publishing'
    // writer and it is off — every such row is a stranded artifact).
    try {
      const purgedPublishing = await sql`
        DELETE FROM scheduled_posts WHERE status = 'publishing' RETURNING id
      `;
      console.log(`[migration] ✓ purged ${purgedPublishing.length} stuck 'publishing' posts`);
    } catch (err: any) {
      console.log(`[migration] ℹ publishing purge skipped: ${err.message}`);
    }
    // Stopgap watchdog test client — every row is a test post, never publishable.
    try {
      const purgedWatchdog = await sql`
        DELETE FROM scheduled_posts
        WHERE status = 'pending' AND client_id = 'client-8f5c81359030e96f'
        RETURNING id
      `;
      console.log(`[migration] ✓ purged ${purgedWatchdog.length} watchdog test posts (client-8f5c81359030e96f)`);
    } catch (err: any) {
      console.log(`[migration] ℹ watchdog purge skipped: ${err.message}`);
    }
    // ── 004b: Approval columns (nullable — legacy rows stay NULL) ──
    await sql`ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ`;
    await sql`ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS approved_by TEXT`;
    console.log("[migration] ✓ scheduled_posts.approved_at / approved_by columns ready");
    // ── 004c: CHECK constraint — approved_at requires approved_by ──
    try {
      await sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'scheduled_posts_approval_consistency'
          ) THEN
            ALTER TABLE scheduled_posts
              ADD CONSTRAINT scheduled_posts_approval_consistency
              CHECK (approved_at IS NULL OR approved_by IS NOT NULL);
          END IF;
        END $$;
      `;
      console.log("[migration] ✓ scheduled_posts_approval_consistency CHECK constraint ready");
    } catch (err: any) {
      console.log(`[migration] ℹ approval CHECK constraint skipped: ${err.message}`);
    }
    // ── 004d: DB-level documentation of the cron contract ──
    try {
      await sql`COMMENT ON TABLE scheduled_posts IS
        'Content records for review and Buffer scheduling. Rows without approved_at are legacy/unapproved content.'`;
      await sql`COMMENT ON COLUMN scheduled_posts.approved_at IS
        'When the post was explicitly approved for Buffer scheduling (client via portal, or ''system'' for internal brand posts). NULL = never approved.'`;
      await sql`COMMENT ON COLUMN scheduled_posts.approved_by IS
        'Who approved the post: client email (portal approval) or ''system'' (internal operations). Required whenever approved_at is set.'`;
      console.log("[migration] ✓ scheduled_posts publish safety comments applied");
    } catch (err: any) {
      console.log(`[migration] ℹ publish safety comments skipped: ${err.message}`);
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
  console.log("[migration] ✓ orders table ready");

  // ══════════════════════════════════════════════════════════════════
  // ── ANALYTICS METRICS TABLES ──
  // ── Transparent, auditable metrics for agency + client dashboards
  // ══════════════════════════════════════════════════════════════════

  // ── post_performance ──
  // Per-post metrics pulled from Meta (Facebook + Instagram).
  // One row per post per day — deduplicated by (post_id, fetched_at::date).
  // Feeds the post-level performance charts in the client portal.
  await sql`
    CREATE TABLE IF NOT EXISTS post_performance (
      id SERIAL PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id),
      platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
      post_id TEXT NOT NULL,
      posted_at TIMESTAMPTZ,
      impressions INTEGER DEFAULT 0,
      reach INTEGER DEFAULT 0,
      engagement INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      fetched_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_post_performance_client ON post_performance(client_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_post_performance_post ON post_performance(post_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_post_performance_posted ON post_performance(posted_at DESC)`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_post_performance_unique
    ON post_performance (post_id, (fetched_at::date))
  `;
  console.log("[migration] ✓ post_performance table ready");

  // ── daily_kpi_snapshot ──
  // Aggregate daily KPIs per client — one row per client per day.
  // Computed from post_performance + conversion_events rollups.
  // Powers the daily trend charts and KPI scorecards in both the agency
  // dashboard and the client portal.
  // cpl_cents and roas_basis_points are computed fields (stored for
  // fast querying, recomputed on each snapshot refresh).
  await sql`
    CREATE TABLE IF NOT EXISTS daily_kpi_snapshot (
      id SERIAL PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id),
      snapshot_date DATE NOT NULL,
      total_impressions INTEGER DEFAULT 0,
      total_reach INTEGER DEFAULT 0,
      total_engagement INTEGER DEFAULT 0,
      total_clicks INTEGER DEFAULT 0,
      total_leads INTEGER DEFAULT 0,
      total_conversions INTEGER DEFAULT 0,
      ad_spend_cents INTEGER DEFAULT 0,
      cpl_cents INTEGER,
      roas_basis_points INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_kpi_snapshot_client ON daily_kpi_snapshot(client_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_kpi_snapshot_date ON daily_kpi_snapshot(snapshot_date DESC)`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_kpi_snapshot_unique
    ON daily_kpi_snapshot (client_id, snapshot_date)
  `;
  console.log("[migration] ✓ daily_kpi_snapshot table ready");

  // ── conversion_events ──
  // Individual conversion/lead events with full attribution tracking.
  // Every lead, call, booking, or sale is logged with source attribution
  // (which post/ad/platform drove it) so both the agency and client can
  // trace every conversion back to the original touchpoint.
  // Commission is tracked per-event for commission-based deal transparency.
  await sql`
    CREATE TABLE IF NOT EXISTS conversion_events (
      id SERIAL PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id),
      source_type TEXT NOT NULL CHECK (source_type IN ('post', 'ad', 'profile', 'direct')),
      source_platform TEXT CHECK (source_platform IN ('facebook', 'instagram')),
      source_post_id TEXT,
      lead_name TEXT,
      lead_email TEXT,
      lead_phone TEXT,
      conversion_type TEXT DEFAULT 'lead' CHECK (conversion_type IN ('lead', 'call', 'booking', 'sale', 'other')),
      conversion_value_cents INTEGER,
      commission_cents INTEGER,
      attributed_at TIMESTAMPTZ DEFAULT NOW(),
      notes TEXT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_conversion_events_client ON conversion_events(client_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_conversion_events_source ON conversion_events(source_post_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_conversion_events_attributed ON conversion_events(attributed_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_conversion_events_type ON conversion_events(client_id, conversion_type)`;
  console.log("[migration] ✓ conversion_events table ready");

  // ── C2: Expand conversion_type CHECK to include Phase 2 types ──
  // Phase 2 adds: purchase, onboarding_complete, lead_submitted
  try {
    await sql`
      ALTER TABLE conversion_events
      DROP CONSTRAINT IF EXISTS conversion_events_conversion_type_check
    `.catch(() => {});
    await sql`
      ALTER TABLE conversion_events
      ADD CONSTRAINT conversion_events_conversion_type_check
      CHECK (conversion_type IN (
        'lead', 'call', 'booking', 'sale', 'other',
        'purchase', 'onboarding_complete', 'lead_submitted'
      ))
    `.catch(() => {});
    console.log("[migration] ✓ conversion_events.conversion_type CHECK expanded");
  } catch (err: any) {
    console.log(`[migration] ℹ conversion_type CHECK migration skipped: ${err.message}`);
  }

  // ── C3: Expand source_platform CHECK to include X/Twitter ──
  try {
    await sql`
      ALTER TABLE conversion_events
      DROP CONSTRAINT IF EXISTS conversion_events_source_platform_check
    `.catch(() => {});
    await sql`
      ALTER TABLE conversion_events
      ADD CONSTRAINT conversion_events_source_platform_check
      CHECK (source_platform IN (
        'facebook', 'instagram', 'x', 'linkedin', 'tiktok', 'google'
      ))
    `.catch(() => {});
    console.log("[migration] ✓ conversion_events.source_platform CHECK expanded");
  } catch (err: any) {
    console.log(`[migration] ℹ source_platform CHECK migration skipped: ${err.message}`);
  }

  // ── Ensure generated image directory exists ──
  const generatedDir = join(process.cwd(), "public", "social", "generated");
  if (!existsSync(generatedDir)) {
    try {
      mkdirSync(generatedDir, { recursive: true });
      console.log("[migration] ✓ public/social/generated/ directory created");
    } catch (err2: any) {
      console.log(`[migration] ℹ generated directory creation skipped: ${err2.message}`);
    }
  } else {
    console.log("[migration] ✓ public/social/generated/ directory exists");
  }

  console.log("[migration] Complete.");
}

// Auto-run when called directly (bun run src/lib/migrate.ts).
// When imported, the caller controls execution.
const isMain = typeof Bun !== "undefined" ? import.meta.main : process.argv[1]?.endsWith("migrate.ts");
if (isMain) {
  migrate().catch((err) => {
    console.error("[migration] Failed:", err.message);
    process.exit(0);
  });
}
