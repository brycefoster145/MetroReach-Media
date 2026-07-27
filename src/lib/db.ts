/**
 * Database client — Neon Postgres via @neondatabase/serverless.
 * MetroReach Digital
 *
 * Creates a `sql` tagged-template client connected to DATABASE_URL.
 * Uses HTTP-based queries (fetch API) — compatible with Vite SSR and edge runtimes.
 * Lazy initialization — connection is only created on first use.
 *
 * Use only inside server-side code (API route handlers, createServerFn).
 */
import { neon } from "@neondatabase/serverless";
import type { NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction | null = null;

function createSql(): NeonQueryFunction {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  // neon() validates the URL internally — let it handle validation
  return neon(url);
}

function getSql(): NeonQueryFunction {
  if (!_sql) {
    _sql = createSql();
  }
  return _sql;
}

/**
 * Proxy that forwards tagged-template calls and property access to the
 * underlying NeonQueryFunction. This gives us:
 *   sql`SELECT ...`           — tagged template
 *   sql.transaction([...])    — property access
 */
function createProxy(): NeonQueryFunction {
  const target = () => {};
  return new Proxy(target, {
    apply(_target, _thisArg, args) {
      const db = getSql();
      return (db as any)(...args);
    },
    get(_target, prop) {
      const db = getSql();
      const val = (db as any)[prop];
      return typeof val === "function" ? val.bind(db) : val;
    },
  }) as unknown as NeonQueryFunction;
}

export const sql = createProxy();
