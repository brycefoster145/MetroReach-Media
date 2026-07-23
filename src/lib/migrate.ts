/**
 * Migration: Create leads and audit_results tables.
 * Run with: bun run src/lib/migrate.ts
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(url, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 10,
  ssl: "require",
});

async function migrate() {
  console.log("Running migration...");

  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      form_data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("✓ leads table ready");

  await sql`
    CREATE TABLE IF NOT EXISTS audit_results (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      result_json JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("✓ audit_results table ready");

  await sql.end();
  console.log("Migration complete.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
