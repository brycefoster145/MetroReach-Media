/**
 * Migration API Route — POST /api/migrate-media-urls
 *
 * One-shot migration: updates media_urls for all pending scheduled_posts
 * by matching post content to Week 1 image references.
 *
 * Hit this endpoint once after deploy, then it can be removed.
 */
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";

const BASE_URL = "https://metroreachagency.com/social";

/**
 * Content → image mapping for Week 1 posts.
 * Each entry: [uniqueContentSubstring, imageFilename]
 * Order matters — first match wins, so put more specific substrings first.
 */
const MAPPING: Array<[string, string]> = [
  // MONDAY
  ["One client. Seven specialists. Zero handoffs", "ig-w1-mon-brand-team.webp"],
  ["We built MetroReach because the agency model is broken", "fb-w1-mon-brand-lockup.webp"],
  ["2–3 leads a week to 15–20", "fb-w1-mon-proof-before-after.webp"],
  ["The traditional agency model sets clients up to fail", "TEXT_ONLY_LINKEDIN"],

  // TUESDAY
  ["If your agency can't tell you your CPL, run", "ig-w1-tue-auth-cpl.webp"],
  ["3 signs your Facebook ads need a creative refresh", "ig-w1-tue-edu-ads-carousel.webp"],
  ["Organic reach isn't dead. It's just harder", "fb-w1-tue-auth-organic-trend.webp"],
  ["Audit your Instagram in 10 minutes", "fb-w1-tue-edu-ig-audit.webp"],
  ["Why CPL is the only metric that matters", "TEXT_ONLY_LINKEDIN"],

  // WEDNESDAY
  ["Your business needs content pillars", "ig-w1-wed-edu-pillars-carousel.webp"],
  ["40% lower cost per lead. 90 days", "ig-w1-wed-proof-metrics.webp"],
  ["The posting cadence that actually works", "fb-w1-wed-edu-cadence.webp"],
  ["From invisible to booked solid", "fb-w1-wed-proof-medspa.webp"],
  ["Building a lead generation system that works across 7 platforms", "TEXT_ONLY_LINKEDIN"],

  // THURSDAY
  ["Stop boosting posts. Start running ads", "ig-w1-thu-auth-boost-vs-ads.webp"],
  ["This is what our Monday creative review looks like", "ig-w1-thu-brand-bts.webp"],
  ["You don't have a content calendar problem", "fb-w1-thu-auth-cal-vs-strategy.webp"],
  ["Client win of the week", "fb-w1-thu-brand-win.webp"],
  ["What $5,000/month should actually buy you", "TEXT_ONLY_LINKEDIN"],

  // FRIDAY
  ["July by the numbers", "ig-w1-fri-proof-july-numbers.webp"],
  ["Weekend project: optimize your Google Business Profile", "ig-w1-fri-edu-gbp-checklist.webp"],
  ["When sellers can see you have a serious marketing operation", "fb-w1-fri-proof-realestate.webp"],
  ["5 content ideas for contractors this weekend", "fb-w1-fri-edu-contractor-ideas.webp"],
  ["The 4 numbers every service business should track weekly", "TEXT_ONLY_LINKEDIN"],

  // SATURDAY
  ["Saturday Scroll: what the MetroReach team is reading", "ig-w1-sat-brand-scroll.webp"],
  ["The average local business spends $1,500/month on ads", "ig-w1-sat-auth-stat.webp"],
  ["This week at MetroReach: what we shipped", "fb-w1-sat-brand-roundup.webp"],
  ["What changed in social media marketing this month", "fb-w1-sat-auth-industry-roundup.webp"],

  // SUNDAY
  ["Sunday reset: audit your social profiles", "ig-w1-sun-edu-audit-checklist.webp"],
  ["DIY marketing → dedicated team", "ig-w1-sun-proof-diy-to-team.webp"],
  ["One thing to fix on your Facebook page this week", "fb-w1-sun-edu-one-fix.webp"],
  ["This is what consistent posting did for one client's pipeline", "fb-w1-sun-proof-compound-growth.webp"],
];

export const Route = createFileRoute("/api/migrate-media-urls")({
  server: {
    handlers: {
      POST: async () => {
        const results: Array<{
          id: string;
          platform: string;
          matched: string;
          media_urls: string[];
        }> = [];

        try {
          // Get all pending posts
          const posts = await sql`
            SELECT id, platform, content
            FROM scheduled_posts
            WHERE status = 'pending'
            ORDER BY due_at ASC
          `;

          console.log(`[migrate-media-urls] Found ${posts.length} pending posts`);

          for (const post of posts) {
            const postId = post.id as string;
            const platform = post.platform as string;
            const content = (post.content as string) || "";

            let matched = false;

            for (const [substring, filename] of MAPPING) {
              if (content.includes(substring)) {
                if (filename === "TEXT_ONLY_LINKEDIN") {
                  // LinkedIn text-only posts — no media
                  console.log(
                    `[migrate-media-urls] ${postId} (${platform}) → TEXT_ONLY (LinkedIn), no media_urls`,
                  );
                  results.push({
                    id: postId,
                    platform,
                    matched: "TEXT_ONLY_LINKEDIN",
                    media_urls: [],
                  });
                  matched = true;
                  break;
                }

                const mediaUrls = [`${BASE_URL}/${filename}`];

                await sql`
                  UPDATE scheduled_posts
                  SET media_urls = ${JSON.stringify(mediaUrls)}::jsonb
                  WHERE id = ${postId}
                `;

                console.log(
                  `[migrate-media-urls] ${postId} (${platform}) → ${filename}`,
                );
                results.push({
                  id: postId,
                  platform,
                  matched: filename,
                  media_urls: mediaUrls,
                });
                matched = true;
                break;
              }
            }

            if (!matched) {
              console.log(
                `[migrate-media-urls] ${postId} (${platform}) → NO MATCH`,
              );
              results.push({
                id: postId,
                platform,
                matched: "NO_MATCH",
                media_urls: [],
              });
            }
          }

          const matchedCount = results.filter(
            (r) => r.matched !== "NO_MATCH" && r.matched !== "TEXT_ONLY_LINKEDIN",
          ).length;
          const linkedinCount = results.filter(
            (r) => r.matched === "TEXT_ONLY_LINKEDIN",
          ).length;
          const unmatchedCount = results.filter(
            (r) => r.matched === "NO_MATCH",
          ).length;

          return new Response(
            JSON.stringify({
              success: true,
              total: posts.length,
              matched: matchedCount,
              linkedin_text_only: linkedinCount,
              unmatched: unmatchedCount,
              results,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          console.error("[migrate-media-urls] Error:", err.message);
          return new Response(
            JSON.stringify({ error: err.message, results }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
