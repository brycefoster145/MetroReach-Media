/**
 * Database client — Neon Postgres via the `postgres` package.
 * MetroReach Digital
 *
 * Creates a singleton `sql` tagged-template client connected to DATABASE_URL.
 * The client handles connection pooling automatically.
 *
 * Use only inside `createServerFn()` handlers or API route handlers
 * (never import into client-side code).
 */

import postgres from "postgres";

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL is not set — connect a database before running queries."
  );
}

export const sql = postgres(url, {
  max: 10, // max pool connections
  idle_timeout: 20, // seconds before idle connection is closed
  connect_timeout: 10, // seconds to wait for connection
  ssl: "require",
});
