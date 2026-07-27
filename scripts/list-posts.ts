/**
 * List ALL Facebook + Instagram posts and identify cleanup candidates.
 * Run with: cd /home/team/shared/site && DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d'"' -f2) npx tsx scripts/list-posts.ts
 */
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = neon(url);

async function main() {
  const posts = await sql`
    SELECT id, platform, status, due_at, created_at, posted_at,
      LEFT(content, 200) as content_preview,
      content
    FROM scheduled_posts
    WHERE platform IN ('facebook', 'instagram')
    ORDER BY platform, status, due_at ASC
  `;

  console.log(`\n=== TOTAL FACEBOOK + INSTAGRAM POSTS: ${posts.length} ===\n`);

  const toDelete: any[] = [];

  for (const p of posts) {
    const reasons: string[] = [];

    if (p.content && p.content.toLowerCase().includes("metroreach digital")) {
      reasons.push("OLD_NAME");
    }

    if (p.created_at) {
      const created = new Date(p.created_at as string);
      const cutoff = new Date("2026-07-26T00:00:00Z");
      if (created < cutoff) {
        reasons.push("BUFFER_ERA");
      }
    }

    if (p.due_at) {
      const due = new Date(p.due_at as string);
      if (due < new Date() && p.status === 'pending') {
        reasons.push("PAST_DUE");
      }
    }

    const marker = reasons.length > 0 ? ` [DELETE: ${reasons.join(", ")}]` : "";
    console.log(`${marker ? "❌" : "✅"} ${p.id} | ${(p.platform as string).padEnd(10)} | ${(p.status as string).padEnd(9)} | due: ${String(p.due_at).substring(0, 33)} | ${(p.content_preview as string).substring(0, 60)}`);

    if (reasons.length > 0) {
      toDelete.push({ id: p.id, platform: p.platform, status: p.status, reasons });
    }
  }

  console.log(`\n=== POSTS TO DELETE: ${toDelete.length} ===`);
  toDelete.forEach(p => {
    console.log(`  ${p.id} (${p.platform}, ${p.status}) — ${p.reasons.join(", ")}`);
  });

  // Also output JSON for automation
  console.log("\n=== DELETE_JSON ===");
  console.log(JSON.stringify(toDelete.map(p => p.id)));
}

main().catch(console.error);
