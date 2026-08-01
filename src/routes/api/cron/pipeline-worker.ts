/** GET/POST /api/cron/pipeline-worker — process exactly one content job. */
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";
import { processContentGeneration } from "~/lib/content-generation";

const STALE_MS = 5 * 60 * 1000;
export const Route = createFileRoute("/api/cron/pipeline-worker")({ server: { handlers: {
  GET: async () => runWorker(), POST: async () => runWorker(),
} } });
async function runWorker() {
  try {
    // Recover jobs abandoned by a killed Vercel invocation.
    await sql`UPDATE pipeline_jobs SET status = 'pending', updated_at = NOW() WHERE status = 'processing' AND updated_at < NOW() - INTERVAL '5 minutes'`;
    const claimed = await sql`UPDATE pipeline_jobs SET status = 'processing', updated_at = NOW() WHERE id = (SELECT id FROM pipeline_jobs WHERE status = 'pending' ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id, client_id, service_slug, payload`;
    if (!claimed.length) return json({ processed: false, message: "No pending jobs" });
    const job = claimed[0] as any;
    try {
      const result = await processContentGeneration(String(job.client_id));
      await sql`UPDATE pipeline_jobs SET status = 'completed', updated_at = NOW() WHERE id = ${job.id}`;
      return json({ processed: true, job_id: job.id, status: "completed", result });
    } catch (err: any) {
      await sql`UPDATE pipeline_jobs SET status = 'failed', error = ${String(err?.message || err)}, updated_at = NOW() WHERE id = ${job.id}`;
      return json({ processed: true, job_id: job.id, status: "failed", error: String(err?.message || err) }, 500);
    }
  } catch (err: any) { console.error("[pipeline-worker] failed:", err.message); return json({ error: err.message }, 500); }
}
function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } }); }
