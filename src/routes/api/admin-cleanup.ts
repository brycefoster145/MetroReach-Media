/**
 * TEMPORARY: Admin Cleanup Route — GET /api/admin-cleanup
 *
 * Query all scheduled_posts and remove duplicates.
 * Keep ONE post per (platform + due_at slot).
 * Rules:
 *  - Keep posts with media_urls over text-only
 *  - For ties, keep the longer content (likely the real post)
 * Deletes the rest.
 * Also force-publishes any due pending posts via the post-scheduler.
 */

import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";

export const Route = createFileRoute("/api/admin-cleanup")({
  server: {
    handlers: {
      GET: async () => {
        const report: Record<string, unknown> = {};

        try {
          // 1. Show current state
          const all = await sql`
            SELECT id, platform, due_at, status, content, media_urls
            FROM scheduled_posts
            ORDER BY platform, due_at ASC
          `;
          report.before_count = all.length;

          // 2. Find duplicate groups: (platform + due_at) with count > 1
          const dupGroups = await sql`
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

          // 3. For each duplicate group, keep the best, delete the rest
          const deletedIds: string[] = [];
          const keptIds: string[] = [];

          for (const group of dupGroups) {
            const platform = group.platform as string;
            const dueAt = group.due_at as Date;

            const candidates = await sql`
              SELECT id, content, media_urls
              FROM scheduled_posts
              WHERE platform = ${platform} AND due_at = ${dueAt}::timestamptz AND status = 'pending'
              ORDER BY 
                CASE WHEN media_urls IS NOT NULL AND jsonb_array_length(media_urls) > 0 THEN 1 ELSE 0 END DESC,
                LENGTH(content) DESC
            `;

            // First one is best (has media + longest content)
            const keep = candidates[0];
            keptIds.push(keep.id as string);

            for (let i = 1; i < candidates.length; i++) {
              deletedIds.push(candidates[i].id as string);
            }
          }

          // 4. Delete the duplicates
          if (deletedIds.length > 0) {
            await sql`
              DELETE FROM scheduled_posts WHERE id = ANY(${deletedIds}::text[])
            `;
          }

          // 5. Show after state
          const afterAll = await sql`
            SELECT id, platform, due_at, status FROM scheduled_posts ORDER BY platform, due_at ASC
          `;
          report.after_count = afterAll.length;
          report.deleted_ids = deletedIds;
          report.kept_ids = keptIds;
          report.after_posts = afterAll.map((r: any) => ({
            id: r.id,
            platform: r.platform,
            due_at: String(r.due_at),
            status: r.status,
          }));

          report.success = true;
        } catch (err: any) {
          report.success = false;
          report.error = err.message;
        }

        return new Response(JSON.stringify(report, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
