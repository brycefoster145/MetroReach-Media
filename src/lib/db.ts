/**
 * Database client — Neon Postgres via the `postgres` package.
 * MetroReach Digital
 *
 * Creates a `sql` tagged-template client connected to DATABASE_URL.
 * Eager initialization — no Proxy, no lazy loading, no bundler pitfalls.
 *
 * Use only inside server-side code (API route handlers, createServerFn).
 */
import postgres from "postgres";
import type { Sql } from "postgres";

const url = process.env.DATABASE_URL;

function createSql(): Sql {
  if (!url) {
    // Dummy that throws on use — allows importing db.ts
    // in environments without DATABASE_URL without crashing.
    const errFn = (() => {
      throw new Error("DATABASE_URL is not set");
    }) as unknown as Sql;
    return errFn;
  }
  return postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: "require",
  });
}

export const sql: Sql = createSql();
