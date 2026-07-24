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

  await sql.end();
  console.log("Migration complete.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
