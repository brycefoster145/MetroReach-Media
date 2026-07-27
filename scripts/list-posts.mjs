/**
 * List ALL Facebook + Instagram posts directly from DB.
 * Reads DATABASE_URL from .env.local directly (not via shell).
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { neon } from '@neondatabase/serverless';

// Read .env.local directly to avoid shell masking
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf8');
const match = envContent.match(/^DATABASE_URL="(.+)"$/m);
if (!match) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}
const url = match[1];
console.error('DB URL length:', url.length, 'starts with:', url.substring(0, 30));

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

  const toDelete = [];

  for (const p of posts) {
    const reasons = [];

    if (p.content && p.content.toLowerCase().includes("metroreach digital")) {
      reasons.push("OLD_NAME");
    }

    if (p.created_at) {
      const created = new Date(p.created_at);
      const cutoff = new Date("2026-07-26T00:00:00Z");
      if (created < cutoff) {
        reasons.push("BUFFER_ERA");
      }
    }

    if (p.due_at) {
      const due = new Date(p.due_at);
      if (due < new Date() && p.status === 'pending') {
        reasons.push("PAST_DUE");
      }
    }

    const marker = reasons.length > 0 ? ` [DELETE: ${reasons.join(", ")}]` : "";
    console.log(`${marker ? "DEL" : "OK "} ${p.id} | ${p.platform.padEnd(10)} | ${p.status.padEnd(9)} | due: ${String(p.due_at).substring(0, 33)} | ${(p.content_preview || '').substring(0, 60)}`);

    if (reasons.length > 0) {
      toDelete.push({ id: p.id, platform: p.platform, status: p.status, reasons });
    }
  }

  console.log(`\n=== POSTS TO DELETE: ${toDelete.length} ===`);
  toDelete.forEach(p => {
    console.log(`  ${p.id} (${p.platform}, ${p.status}) — ${p.reasons.join(", ")}`);
  });

  // Output just the IDs for automation
  console.log("\n=== DELETE_IDS ===");
  console.log(JSON.stringify(toDelete.map(p => p.id)));

  // Output for curl commands
  console.log("\n=== CURL_COMMANDS ===");
  toDelete.forEach(p => {
    console.log(`curl -s -X POST https://metroreachagency.com/api/cancel-post -H "Content-Type: application/json" -d '{"post_id":"${p.id}"}'`);
  });
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
