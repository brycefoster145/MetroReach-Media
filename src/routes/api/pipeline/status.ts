/**
 * Pipeline Status API — MetroReach Digital
 *
 * Returns the current delivery pipeline status for a client by ID.
 * Used by the client dashboard and internal admin views.
 *
 * GET /api/pipeline/status?id=client-abc123
 */

import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";

// ── Pipeline stage definitions ──

const PIPELINE_STAGES = [
  { key: "onboarding", label: "Account Setup & Onboarding", order: 1 },
  { key: "strategy", label: "Strategy Development", order: 2 },
  { key: "content_creation", label: "Content Creation", order: 3 },
  { key: "review", label: "Review & Approval", order: 4 },
  { key: "launch", label: "Campaign Launch", order: 5 },
  { key: "active", label: "Active Management", order: 6 },
  { key: "reporting", label: "Performance Reporting", order: 7 },
] as const;

export type PipelineStageKey = (typeof PIPELINE_STAGES)[number]["key"];

function buildTimeline(currentStage: string) {
  const currentIdx = PIPELINE_STAGES.findIndex((s) => s.key === currentStage);

  return PIPELINE_STAGES.map((stage, idx) => ({
    key: stage.key,
    label: stage.label,
    order: stage.order,
    status:
      idx < currentIdx
        ? ("completed" as const)
        : idx === currentIdx
          ? ("active" as const)
          : ("pending" as const),
  }));
}

export const Route = createFileRoute("/api/pipeline/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const clientId = url.searchParams.get("id");

        if (!clientId) {
          return new Response(
            JSON.stringify({ error: "Missing required query parameter: id" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // Query the client record
        let rows: any[];
        try {
          rows = await sql`
            SELECT
              id, email, name, company, service, service_slug,
              status, pipeline_status, onboarding_data,
              created_at, updated_at
            FROM clients
            WHERE id = ${clientId}
            LIMIT 1
          `;
        } catch (err: any) {
          console.error("Pipeline status query error:", err.message);
          return new Response(
            JSON.stringify({ error: "Database error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        if (!rows.length) {
          return new Response(
            JSON.stringify({ error: "Client not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } },
          );
        }

        const client = rows[0];
        const timeline = buildTimeline(client.pipeline_status || "pending");

        return new Response(
          JSON.stringify({
            client: {
              id: client.id,
              name: client.name,
              service: client.service,
              status: client.status,
            },
            pipeline: {
              current_stage: client.pipeline_status || "pending",
              timeline,
            },
            updated_at: String(client.updated_at),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
