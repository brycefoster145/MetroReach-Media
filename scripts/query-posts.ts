import { sql } from "../src/db.ts";

const result = await sql`
  SELECT id, platform, 
    due_at AT TIME ZONE 'America/New_York' as due_at_est, 
    status, 
    LEFT(content, 100) as preview 
  FROM scheduled_posts 
  WHERE status = 'pending' 
  ORDER BY due_at ASC
`;

console.log(`Total pending: ${result.length}\n`);
for (const row of result) {
  console.log(`${row.platform.toUpperCase()} | ${row.due_at_est} | ${row.preview}`);
}
