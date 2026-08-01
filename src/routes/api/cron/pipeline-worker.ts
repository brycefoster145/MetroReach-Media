/**
 * GET/POST /api/cron/pipeline-worker — process exactly ONE unit of work per invocation.
 *
 * Each cron tick claims one pending job and advances it by a single step:
 *   step 0 — generate the 12-post content calendar (one OpenAI call, stored in payload)
 *   steps 1..N — generate ONE image + post (fits comfortably inside Vercel's 60s limit)
 *
 * Progress lives in job.payload: { calendar, currentIndex, results[], retries }.
 * A job flips back to 'pending' after each step so the next tick picks it up;
 * it becomes 'completed' after the last image. A failed step increments
 * payload.retries; after 3 consecutive failures the whole job is marked 'failed'.
 */
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";
import {
  loadClientData,
  generateContentCalendar,
  generateOneImage,
  type GeneratedCalendar,
  type GeneratedPostResult,
} from "~/lib/content-generation";

const STALE_MS = 5 * 60 * 1000;
const MAX_RETRIES = 3;

export const Route = createFileRoute("/api/cron/pipeline-worker")({ server: { handlers: {
  GET: async () => runWorker(), POST: async () => runWorker(),
} } });

interface JobPayload {
  client_id?: string;
  calendar?: GeneratedCalendar;
  currentIndex?: number;
  results?: GeneratedPostResult[];
  retries?: number;
}

async function runWorker() {
  try {
    // Recover jobs abandoned by a killed Vercel invocation (progress in payload survives).
    await sql`UPDATE pipeline_jobs SET status = 'pending', updated_at = NOW() WHERE status = 'processing' AND updated_at < NOW() - (${STALE_MS} * interval '1 millisecond')`;

    // Claim exactly one pending job atomically.
    const claimed = await sql`UPDATE pipeline_jobs SET status = 'processing', updated_at = NOW() WHERE id = (SELECT id FROM pipeline_jobs WHERE status = 'pending' ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id, client_id, service_slug, payload`;
    if (!claimed.length) return json({ processed: false, message: "No pending jobs" });
    const job = claimed[0] as any;
    const rawPayload = job.payload as unknown;
    const payload: JobPayload = (typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload) || {};

    try {
      const outcome = await processOneStep(String(job.client_id), payload);
      await sql`UPDATE pipeline_jobs SET status = ${outcome.status}, payload = ${JSON.stringify(outcome.payload)}::jsonb, updated_at = NOW() WHERE id = ${job.id}`;
      return json({ processed: true, job_id: job.id, status: outcome.status, ...outcome.detail });
    } catch (err: any) {
      // Retryable failure (calendar or image generation) — count it, don't fail instantly.
      const retries = (payload.retries || 0) + 1;
      const nextPayload = { ...payload, retries };
      const message = String(err?.message || err);
      console.error(`[pipeline-worker] step failed for job ${job.id}:`, message);
      if (retries >= MAX_RETRIES) {
        await sql`UPDATE pipeline_jobs SET status = 'failed', error = ${message}, payload = ${JSON.stringify(nextPayload)}::jsonb, updated_at = NOW() WHERE id = ${job.id}`;
        return json({ processed: true, job_id: job.id, status: "failed", retries, error: message }, 500);
      }
      await sql`UPDATE pipeline_jobs SET status = 'pending', payload = ${JSON.stringify(nextPayload)}::jsonb, updated_at = NOW() WHERE id = ${job.id}`;
      return json({ processed: true, job_id: job.id, status: "retry_scheduled", retries, error: message });
    }
  } catch (err: any) { console.error("[pipeline-worker] failed:", err.message); return json({ error: err.message }, 500); }
}

/** Advance the job exactly one step and return the next status + payload. */
async function processOneStep(clientId: string, payload: JobPayload): Promise<{
  status: "pending" | "completed";
  payload: JobPayload;
  detail: Record<string, unknown>;
}> {
  // Step 0: no calendar yet → generate it once and park back to pending.
  if (!payload.calendar) {
    const client = await loadClientData(clientId);
    const calendar = await generateContentCalendar(client);
    return {
      status: "pending",
      payload: { ...payload, client_id: clientId, calendar, currentIndex: 0, results: payload.results || [], retries: 0 },
      detail: { step: "calendar_generated", total_posts: calendar.posts.length },
    };
  }

  const calendar = payload.calendar;
  const currentIndex = payload.currentIndex || 0;
  const results = payload.results || [];

  // All images done → mark the job completed (results already in payload).
  if (currentIndex >= calendar.posts.length) {
    return {
      status: "completed",
      payload: { ...payload, results },
      detail: { step: "all_done", posts_generated: results.length },
    };
  }

  // One image + one post for the current index.
  const client = await loadClientData(clientId);
  const result = await generateOneImage(client, calendar, currentIndex);
  const nextResults = [...results, result];
  const nextIndex = currentIndex + 1;
  const done = nextIndex >= calendar.posts.length;
  return {
    status: done ? "completed" : "pending",
    payload: { ...payload, client_id: clientId, calendar, currentIndex: nextIndex, results: nextResults, retries: 0 },
    detail: {
      step: "image_generated",
      index: currentIndex,
      platform: result.platform,
      image_url: result.image_url,
      progress: `${nextIndex}/${calendar.posts.length}`,
    },
  };
}

function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } }); }
