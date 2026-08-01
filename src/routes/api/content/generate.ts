/** POST /api/content/generate — enqueue asynchronous content generation. */
import { createFileRoute } from "@tanstack/react-router";
import { randomBytes } from "node:crypto";
import { sql } from "~/lib/db";
import { requireApiKey } from "~/lib/env";

export const Route = createFileRoute("/api/content/generate")({
  server: { handlers: { POST: async ({ request }) => {
    const unauthorized = requireApiKey(request);
    if (unauthorized) return unauthorized;
    try {
      const body = await request.json() as { client_id?: unknown; service_slug?: unknown };
      const clientId = typeof body.client_id === "string" ? body.client_id.trim() : "";
      if (!clientId) return new Response(JSON.stringify({ error: "client_id is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
      const clients = await sql`SELECT id, service_slug FROM clients WHERE id = ${clientId} LIMIT 1`;
      if (!clients.length) return new Response(JSON.stringify({ error: "Client not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
      const jobId = `pipeline-${randomBytes(12).toString("hex")}`;
      const serviceSlug = typeof body.service_slug === "string" ? body.service_slug : (clients[0].service_slug as string || "premium-growth-audit");
      await sql`INSERT INTO pipeline_jobs (id, client_id, service_slug, status, payload) VALUES (${jobId}, ${clientId}, ${serviceSlug}, 'pending', ${JSON.stringify({ client_id: clientId })}::jsonb)`;
      return new Response(JSON.stringify({ accepted: true, job_id: jobId }), { status: 202, headers: { "Content-Type": "application/json" } });
    } catch (err: any) {
      console.error("[content-gen] Queue failed:", err.message);
      return new Response(JSON.stringify({ error: "Failed to queue content generation", detail: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  } } },
});
