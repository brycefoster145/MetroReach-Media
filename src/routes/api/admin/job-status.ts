/** GET /api/admin/job-status?client_id=... */
import { createFileRoute } from "@tanstack/react-router";
import { requireApiKey } from "~/lib/env";
import { sql } from "~/lib/db";
export const Route = createFileRoute("/api/admin/job-status")({ server: { handlers: { GET: async ({ request }) => {
        const unauthorized = requireApiKey(request);
        if (unauthorized) return unauthorized;
  try { const clientId = new URL(request.url).searchParams.get("client_id")?.trim(); if (!clientId) return new Response(JSON.stringify({ error: "client_id is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    const jobs = await sql`SELECT id, client_id, service_slug, status, created_at, updated_at, error FROM pipeline_jobs WHERE client_id = ${clientId} ORDER BY created_at DESC`;
    return new Response(JSON.stringify({ client_id: clientId, jobs }), { headers: { "Content-Type": "application/json" } });
  } catch (err: any) { return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } }); }
} } } });
