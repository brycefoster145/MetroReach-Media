/**
 * Database client — Neon Postgres via the `postgres` package.
 * MetroReach Digital
 *
 * Creates a lazy `sql` tagged-template client connected to DATABASE_URL.
 * The connection is deferred until the first query — this prevents crashes
 * in environments where DATABASE_URL isn't set (local dev, sandbox previews)
 * as long as no database queries are actually executed.
 *
 * Use only inside `createServerFn()` handlers or API route handlers
 * (never import into client-side code).
 */

import postgres from "postgres";
import type { Sql } from "postgres";

let _sql: Sql | null = null;

function getSql(): Sql {
  if (_sql) return _sql;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set — connect a database before running queries."
    );
  }

  _sql = postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: "require",
  });

  return _sql;
}

/**
 * Lazy sql tagged-template function.
 * The first call initializes the connection pool; subsequent calls reuse it.
 */
export const sql = new Proxy({} as Sql, {
  get(_target, prop) {
    const client = getSql();
    const value = (client as any)[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
  apply(_target, _thisArg, args) {
    const client = getSql();
    return (client as any)(...args);
  },
});
