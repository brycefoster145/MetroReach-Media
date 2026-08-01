/**
 * Admin endpoint: Replace flagged posts with clean content.
 *
 * POST /api/admin/replace-flagged
 * Auth: x-api-key header (MS_API_KEY)
 *
 * Matches pending posts by content substring against the FLAGGED_REPLACEMENTS
 * map and updates them with clean replacement text that honors the
 * Zero Contradictions Policy.
 *
 * Dry-run mode: add ?dry_run=true to preview matches without updating.
 */
import { createFileRoute } from "@tanstack/react-router";
import { requireApiKey } from "~/lib/env";
import { sql } from "~/lib/db";
import { FLAGGED_REPLACEMENTS } from "~/data/flagged-replacements";

export const Route = createFileRoute("/api/admin/replace-flagged")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = requireApiKey(request);
        if (unauthorized) return unauthorized;
        const apiKey = request.headers.get("x-api-key") ?? "";
        const expectedKey = process.env.MS_API_KEY ?? "";
        if (!apiKey || apiKey !== expectedKey) {
          return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }

        const url = new URL(request.url);
        const dryRun = url.searchParams.get("dry_run") === "true";

        const results: Array<{
          matchPattern: string;
          platform: string;
          matched: number;
          updated: number;
          errors: string[];
        }> = [];

        let totalMatched = 0;
        let totalUpdated = 0;

        for (const entry of FLAGGED_REPLACEMENTS) {
          const result = {
            matchPattern: entry.matchPattern.substring(0, 60) + "...",
            platform: entry.platform,
            matched: 0,
            updated: 0,
            errors: [] as string[],
          };

          try {
            // Find posts matching the content pattern for this platform
            const rows = await sql`
              SELECT id, content, platform
              FROM scheduled_posts
              WHERE platform = ${entry.platform}
                AND status = 'pending'
                AND content ILIKE ${"%" + entry.matchPattern + "%"}
            `;

            result.matched = rows.length;
            totalMatched += rows.length;

            if (rows.length > 0) {
              const matchedIds = rows.map((r: any) => r.id).join(", ");
              console.log(
                `[replace-flagged] Matched ${rows.length} post(s) for pattern "${entry.matchPattern.substring(0, 40)}..." on ${entry.platform}: [${matchedIds}]`,
              );

              if (!dryRun) {
                const updateResult = await sql`
                  UPDATE scheduled_posts
                  SET content = ${entry.replacement}
                  WHERE platform = ${entry.platform}
                    AND status = 'pending'
                    AND content ILIKE ${"%" + entry.matchPattern + "%"}
                  RETURNING id
                `;
                result.updated = updateResult.length;
                totalUpdated += updateResult.length;
                console.log(
                  `[replace-flagged] Updated ${updateResult.length} post(s) on ${entry.platform}`,
                );
              } else {
                console.log(
                  `[replace-flagged] DRY RUN — would have updated ${rows.length} post(s)`,
                );
              }
            }
          } catch (err: any) {
            result.errors.push(err.message);
            console.error(
              `[replace-flagged] Error matching "${entry.matchPattern.substring(0, 40)}...": ${err.message}`,
            );
          }

          results.push(result);
        }

        return new Response(
          JSON.stringify({
            dry_run: dryRun,
            total_matched: totalMatched,
            total_updated: totalUpdated,
            replacements_attempted: FLAGGED_REPLACEMENTS.length,
            results,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    },
  },
});
