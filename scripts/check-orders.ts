import { sql } from "../src/lib/db";
const orders = await sql`SELECT id, email, name, company, service, status, pipeline_status, portal_token, created_at FROM orders ORDER BY created_at DESC LIMIT 5`;
console.log(JSON.stringify(orders.rows, null, 2));
