import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: "require",
});

const rows = await sql`
  SELECT id, platform, substring(content, 1, 100) as snippet, media_urls, due_at, status
  FROM scheduled_posts
  ORDER BY due_at ASC
`;

for (const r of rows) {
  const urls = Array.isArray(r.media_urls) ? r.media_urls : [];
  console.log(`${r.id} | ${r.platform} | ${r.due_at} | urls=${urls.length} | ${r.status} | ${(r.snippet as string).substring(0, 80)}`);
}
console.log(`\nTotal: ${rows.length}`);

await sql.end();
