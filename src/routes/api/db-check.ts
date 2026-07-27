/**
 * Database Diagnostic Endpoint — GET /api/db-check
 *
 * Tests the database connection using BOTH the `postgres` package (TCP, used by
 * the cron scheduler) and `@neondatabase/serverless` (HTTP, serverless-native).
 * Reports table existence, row counts, sample pending posts, and timezone info.
 *
 * POST actions:
 *   {"action": "cleanup"} — deduplicate pending posts (default)
 *   {"action": "reset-failed"} — reset failed IG posts to pending
 */
import { createFileRoute } from "@tanstack/react-router";
import postgres from "postgres";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;

export const Route = createFileRoute("/api/db-check")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const reqUrl = new URL(request.url);
        const listParam = reqUrl.searchParams.get("list");

        // ── Full listing mode: ?list=fb,ig returns all Facebook + Instagram posts ──
        if (listParam) {
          const platforms = listParam.split(",").map(s => s.trim());
          const validPlatforms = platforms.filter(p => ["fb", "ig", "facebook", "instagram"].includes(p));
          if (validPlatforms.length === 0) {
            return new Response(JSON.stringify({ error: "Use ?list=fb,ig" }), { status: 400, headers: { "Content-Type": "application/json" } });
          }
          try {
            if (!url) throw new Error("DATABASE_URL not set");
            const n = neon(url);
            const dbPlatforms = validPlatforms.map(p => p === "fb" ? "facebook" : p === "ig" ? "instagram" : p);
            const posts = await n`
              SELECT id, platform, status, due_at, created_at, posted_at, content
              FROM scheduled_posts
              WHERE platform = ANY(${dbPlatforms}::text[])
              ORDER BY platform, status, due_at ASC
            `;
            return new Response(JSON.stringify({
              total: posts.length,
              posts: posts.map((p: any) => ({
                ...p,
                due_at: String(p.due_at),
                created_at: p.created_at ? String(p.created_at) : null,
                posted_at: p.posted_at ? String(p.posted_at) : null,
              })),
            }), { status: 200, headers: { "Content-Type": "application/json" } });
          } catch (err: any) {
            return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
          }
        }

        const report: Record<string, unknown> = {
          has_db_url: !!url,
          timestamp: new Date().toISOString(),
        };

        // ── Test 1: @neondatabase/serverless (HTTP) ──
        try {
          if (!url) throw new Error("DATABASE_URL not set");
          const n = neon(url);

          // Check if scheduled_posts exists
          const tableCheck = await n`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_name = 'scheduled_posts'
            ) as exists;
          `;
          report.neon = { connected: true, table_exists: tableCheck[0]?.exists };

          if (tableCheck[0]?.exists) {
            const count = await n`SELECT COUNT(*) as cnt FROM scheduled_posts`;
            report.neon.total_rows = Number(count[0]?.cnt);

            const pending = await n`
              SELECT COUNT(*) as cnt FROM scheduled_posts WHERE status = 'pending'
            `;
            report.neon.pending_rows = Number(pending[0]?.cnt);

            const duePending = await n`
              SELECT COUNT(*) as cnt FROM scheduled_posts 
              WHERE status = 'pending' AND due_at <= NOW()
            `;
            report.neon.due_pending_rows = Number(duePending[0]?.cnt);

            // Sample 5 pending posts
            const samples = await n`
              SELECT id, status, due_at, 
                NOW() as server_time,
                NOW() AT TIME ZONE 'UTC' as server_time_utc,
                due_at <= NOW() as is_due,
                platform,
                LEFT(content, 80) as content_preview
              FROM scheduled_posts 
              WHERE status = 'pending'
              ORDER BY due_at ASC
              LIMIT 5
            `;
            report.neon.sample_pending = samples.map((r: any) => ({
              ...r,
              due_at: String(r.due_at),
              server_time: String(r.server_time),
              server_time_utc: String(r.server_time_utc),
            }));

            // Failed Instagram posts from 2026-07-26+
            const failedIG = await n`
              SELECT id, status, due_at, meta_post_id, posted_at,
                LEFT(content, 80) as content_preview
              FROM scheduled_posts
              WHERE platform = 'instagram' AND status = 'failed' AND due_at >= '2026-07-26'
              ORDER BY due_at ASC
            `;
            report.neon.failed_instagram = failedIG.map((r: any) => ({
              ...r,
              due_at: String(r.due_at),
              posted_at: r.posted_at ? String(r.posted_at) : null,
            }));

            // Instagram posts with status='posted' from yesterday that may be false positives
            const suspectIG = await n`
              SELECT id, status, due_at, meta_post_id, posted_at,
                LEFT(content, 80) as content_preview
              FROM scheduled_posts
              WHERE platform = 'instagram' AND status = 'posted' AND due_at >= '2026-07-26'
                AND (meta_post_id IS NULL OR meta_post_id = '')
              ORDER BY due_at ASC
            `;
            report.neon.suspect_instagram = suspectIG.map((r: any) => ({
              ...r,
              due_at: String(r.due_at),
              posted_at: r.posted_at ? String(r.posted_at) : null,
            }));

            // Timezone diagnostic
            const tz = await n`SELECT NOW() as now, NOW() AT TIME ZONE 'UTC' as utc, CURRENT_SETTING('timezone') as tz`;
            report.neon.timezone = tz[0];
          }
        } catch (err: any) {
          report.neon = { connected: false, error: err.message };
        }

        // ── Test 2: postgres package (TCP — same as cron) ──
        try {
          if (!url) throw new Error("DATABASE_URL not set");
          const pg = postgres(url, {
            max: 1,
            idle_timeout: 5,
            connect_timeout: 10,
            ssl: "require",
          });

          const tableCheck = await pg`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_name = 'scheduled_posts'
            ) as exists;
          `;
          report.postgres = { connected: true, table_exists: tableCheck[0]?.exists };

          if (tableCheck[0]?.exists) {
            const count = await pg`SELECT COUNT(*) as cnt FROM scheduled_posts`;
            report.postgres.total_rows = Number(count[0]?.cnt);

            const duePending = await pg`
              SELECT COUNT(*) as cnt FROM scheduled_posts 
              WHERE status = 'pending' AND due_at <= NOW()
            `;
            report.postgres.due_pending_rows = Number(duePending[0]?.cnt);

            const samples = await pg`
              SELECT id, status, due_at, 
                NOW() as server_time,
                due_at <= NOW() as is_due,
                platform,
                LEFT(content, 80) as content_preview
              FROM scheduled_posts 
              WHERE status = 'pending'
              ORDER BY due_at ASC
              LIMIT 5
            `;
            report.postgres.sample_pending = samples.map((r: any) => ({
              ...r,
              due_at: String(r.due_at),
              server_time: String(r.server_time),
            }));
          }

          await pg.end();
        } catch (err: any) {
          report.postgres = { connected: false, error: err.message };
        }

        return new Response(JSON.stringify(report, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },

      // ── POST: Cleanup duplicates OR reset failed IG posts ──
      POST: async ({ request }) => {
        let body: { action?: string } = {};
        try {
          body = await request.json();
        } catch { /* no body, default to cleanup */ }

        const action = body.action || "cleanup";

        if (action === "reset-failed") {
          return handleResetFailed();
        }
        if (action === "cleanup-old-name") {
          return handleCleanupOldName();
        }
        return handleCleanup();
      },
    },
  },
});

async function handleResetFailed(): Promise<Response> {
  const report: Record<string, unknown> = { action: "reset-failed" };
  try {
    if (!url) throw new Error("DATABASE_URL not set");
    const pg = postgres(url, {
      max: 1,
      idle_timeout: 5,
      connect_timeout: 10,
      ssl: "require",
    });

    // Find failed Instagram posts from 2026-07-26+
    const failed = await pg`
      SELECT id, platform, due_at, status
      FROM scheduled_posts
      WHERE platform = 'instagram' AND status = 'failed' AND due_at >= '2026-07-26'
    `;

    report.failed_count = failed.length;
    report.failed_ids = failed.map((r: any) => r.id);

    if (failed.length > 0) {
      const ids = failed.map((r: any) => r.id);
      await pg`
        UPDATE scheduled_posts
        SET status = 'pending', meta_post_id = NULL, posted_at = NULL
        WHERE id = ANY(${ids}::text[])
      `;

      // Also check for suspect posted IG posts without meta_post_id
      await pg`
        UPDATE scheduled_posts
        SET status = 'pending', meta_post_id = NULL, posted_at = NULL
        WHERE platform = 'instagram'
          AND status = 'posted'
          AND due_at >= '2026-07-26'
          AND (meta_post_id IS NULL OR meta_post_id = '')
      `;
    }

    // Verify after reset
    const dueNow = await pg`
      SELECT COUNT(*) as cnt FROM scheduled_posts
      WHERE status = 'pending' AND due_at <= NOW()
    `;
    report.due_pending_count = Number(dueNow[0]?.cnt);

    await pg.end();
    report.success = true;
  } catch (err: any) {
    report.success = false;
    report.error = err.message;
  }

  return new Response(JSON.stringify(report, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleCleanup(): Promise<Response> {
  const report: Record<string, unknown> = { action: "cleanup" };
  try {
    if (!url) throw new Error("DATABASE_URL not set");
    const pg = postgres(url, {
      max: 1,
      idle_timeout: 5,
      connect_timeout: 10,
      ssl: "require",
    });

    // Find duplicate groups (platform + due_at, pending, count > 1)
    const dupGroups = await pg`
      SELECT platform, due_at, COUNT(*) as cnt
      FROM scheduled_posts
      WHERE status = 'pending'
      GROUP BY platform, due_at
      HAVING COUNT(*) > 1
      ORDER BY due_at ASC
    `;
    report.duplicate_groups = dupGroups.map((r: any) => ({
      platform: r.platform,
      due_at: String(r.due_at),
      count: Number(r.cnt),
    }));

    const deletedIds: string[] = [];
    const keptIds: string[] = [];

    for (const group of dupGroups) {
      const platform = group.platform as string;
      const dueAt = group.due_at as Date;

      const candidates = await pg`
        SELECT id, content, media_urls
        FROM scheduled_posts
        WHERE platform = ${platform}
          AND due_at = ${dueAt}::timestamptz
          AND status = 'pending'
        ORDER BY 
          CASE WHEN media_urls IS NOT NULL AND jsonb_typeof(media_urls) = 'array' AND jsonb_array_length(media_urls) > 0 THEN 1 ELSE 0 END DESC,
          LENGTH(content) DESC
      `;

      const keep = candidates[0];
      keptIds.push(keep.id as string);

      for (let i = 1; i < candidates.length; i++) {
        deletedIds.push(candidates[i].id as string);
      }
    }

    if (deletedIds.length > 0) {
      await pg`
        DELETE FROM scheduled_posts WHERE id = ANY(${deletedIds}::text[])
      `;
    }

    const afterCount = await pg`SELECT COUNT(*) as cnt FROM scheduled_posts`;
    report.before_count = Number(afterCount[0]?.cnt) + deletedIds.length;
    report.after_count = Number(afterCount[0]?.cnt);
    report.deleted_count = deletedIds.length;
    report.deleted_ids = deletedIds;
    report.kept_ids = keptIds;

    await pg.end();
    report.success = true;
  } catch (err: any) {
    report.success = false;
    report.error = err.message;
  }

  return new Response(JSON.stringify(report, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleCleanupOldName(): Promise<Response> {
  const report: Record<string, unknown> = { action: "cleanup-old-name" };
  try {
    if (!url) throw new Error("DATABASE_URL not set");
    const pg = postgres(url, {
      max: 1,
      idle_timeout: 5,
      connect_timeout: 10,
      ssl: "require",
    });

    // Find all Facebook + Instagram posts matching cleanup criteria
    const candidates = await pg`
      SELECT id, platform, status, content, due_at, created_at
      FROM scheduled_posts
      WHERE platform IN ('facebook', 'instagram')
        AND (
          LOWER(content) LIKE '%metroreach digital%'
          OR created_at < '2026-07-26T00:00:00Z'::timestamptz
          OR (status = 'pending' AND due_at < NOW())
        )
    `;

    report.found_count = candidates.length;
    report.deleted_ids = candidates.map((r: any) => r.id);
    report.deleted_details = candidates.map((r: any) => ({
      id: r.id,
      platform: r.platform,
      status: r.status,
      due_at: String(r.due_at),
      content_preview: (r.content as string).substring(0, 60),
    }));

    if (candidates.length > 0) {
      const ids = candidates.map((r: any) => r.id);
      await pg`
        DELETE FROM scheduled_posts WHERE id = ANY(${ids}::text[])
      `;
    }

    // Verify remaining FB+IG count
    const afterCount = await pg`
      SELECT COUNT(*) as cnt FROM scheduled_posts
      WHERE platform IN ('facebook', 'instagram')
    `;
    report.after_fb_ig_count = Number(afterCount[0]?.cnt);

    // Verify zero "MetroReach Digital" posts remain
    const oldNameCheck = await pg`
      SELECT COUNT(*) as cnt FROM scheduled_posts
      WHERE LOWER(content) LIKE '%metroreach digital%'
    `;
    report.old_name_remaining = Number(oldNameCheck[0]?.cnt);

    await pg.end();
    report.success = true;
  } catch (err: any) {
    report.success = false;
    report.error = err.message;
  }

  return new Response(JSON.stringify(report, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
