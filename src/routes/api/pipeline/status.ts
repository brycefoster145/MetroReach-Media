/**
 * Pipeline Status API — MetroReach Digital
 *
 * Returns the current delivery pipeline status for a client by ID.
 * Includes detailed progress: which step, what was completed,
 * what's next, ETA, and links to generated deliverables.
 *
 * GET /api/pipeline/status?id=client-abc123
 */

import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";
import { getPipelineProgress, PIPELINE_MAP } from "~/lib/pipeline-executor";
import type { PipelineProgress, PipelineStep } from "~/lib/pipeline-executor";

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

// ── Helpers ──

const STEP_LABELS: Record<string, string> = {
  research: "Research & Discovery",
  create: "Content Creation",
  review: "Quality Review",
  deliver: "Client Delivery",
  monitor: "Active Monitoring",
  engage: "Community Engagement",
  report: "Performance Reporting",
  setup: "Initial Setup",
};

const STEP_DURATION_HOURS: Record<string, number> = {
  research: 24,
  create: 48,
  review: 24,
  deliver: 2,
  setup: 4,
  monitor: 0,
  engage: 0,
  report: 6,
};

function buildTimeline(currentStage: string) {
  const currentIdx = PIPELINE_STAGES.findIndex((s) => s.key === currentStage);
  const effectiveIdx = currentIdx === -1 ? 0 : currentIdx;

  return PIPELINE_STAGES.map((stage, idx) => ({
    key: stage.key,
    label: stage.label,
    order: stage.order,
    status:
      idx < effectiveIdx
        ? ("completed" as const)
        : idx === effectiveIdx
          ? ("active" as const)
          : ("pending" as const),
  }));
}

/**
 * Map pipeline_status value to a high-level stage.
 * Pipeline status can be a stage name (e.g., "active") or a step key
 * (e.g., "content-calendar:create").
 */
function mapToStage(pipelineStatus: string): string {
  // If it's already a stage name, return it
  const stageKeys = PIPELINE_STAGES.map((s) => s.key);
  if (stageKeys.includes(pipelineStatus as any)) {
    return pipelineStatus;
  }

  // If it contains ":", it's a step key — map to content_creation
  if (pipelineStatus.includes(":")) {
    const step = pipelineStatus.split(":")[1];
    if (step === "research") return "strategy";
    if (step === "create") return "content_creation";
    if (step === "review") return "review";
    if (step === "deliver") return "launch";
    if (step === "monitor" || step === "engage") return "active";
    if (step === "report") return "reporting";
    return "strategy";
  }

  // Default
  return "onboarding";
}

function estimateEta(remainingSteps: PipelineStep[]): string | null {
  if (remainingSteps.length === 0) return null;
  const totalHours = remainingSteps.reduce(
    (sum, s) => sum + (STEP_DURATION_HOURS[s] || 0),
    0,
  );
  if (totalHours <= 0) return null;
  const eta = new Date(Date.now() + totalHours * 3600 * 1000);
  return eta.toISOString();
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
        const currentPipelineStatus = (client.pipeline_status || "pending") as string;
        const mappedStage = mapToStage(currentPipelineStatus);
        const timeline = buildTimeline(mappedStage);

        // Get detailed pipeline progress
        let detailedProgress: PipelineProgress[] = [];
        let completedLogEntries: any[] = [];
        try {
          detailedProgress = await getPipelineProgress(clientId);
        } catch (err: any) {
          console.error("Failed to get detailed pipeline progress:", err.message);
        }

        // Get log entries from pipeline_log
        try {
          completedLogEntries = await sql`
            SELECT step_key, status, deliverables, created_at
            FROM pipeline_log
            WHERE client_id = ${clientId}
            ORDER BY created_at ASC
          `;
        } catch {
          completedLogEntries = [];
        }

        // Build per-pipeline status with details
        const servicePipelines =
          PIPELINE_MAP[client.service_slug as string] || [];
        const pipelinesStatus = servicePipelines.map((pipeline) => {
          const pipelineKey = pipeline.file.replace(".md", "");
          const completedSteps = completedLogEntries
            .filter((e) => (e.step_key as string).startsWith(pipelineKey + ":"))
            .map((e) => (e.step_key as string).replace(pipelineKey + ":", ""));

          const allSteps = pipeline.steps;
          const completedCount = completedSteps.length;
          const totalCount = allSteps.length;
          const currentStep =
            completedCount < totalCount ? allSteps[completedCount] : allSteps[totalCount - 1];
          const remainingSteps = allSteps.slice(completedCount);

          // Extract deliverable links from log entries
          const deliverableLinks = completedLogEntries
            .filter((e) => (e.step_key as string).startsWith(pipelineKey + ":"))
            .map((e) => {
              const step = (e.step_key as string).replace(pipelineKey + ":", "");
              return {
                step,
                label: STEP_LABELS[step] || step,
                completedAt: e.created_at ? String(e.created_at) : null,
                data: e.deliverables || null,
              };
            });

          return {
            pipeline: pipeline.label,
            file: pipeline.file,
            recurring: pipeline.recurring,
            intervalHours: pipeline.intervalHours || null,
            currentStep,
            currentStepLabel: STEP_LABELS[currentStep] || currentStep,
            progress: {
              completed: completedCount,
              total: totalCount,
              percent: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
            },
            completedSteps: completedSteps.map((s) => ({
              step: s,
              label: STEP_LABELS[s] || s,
            })),
            remainingSteps: remainingSteps.map((s) => ({
              step: s,
              label: STEP_LABELS[s] || s,
            })),
            nextStepEta: estimateEta(remainingSteps),
            deliverables: deliverableLinks,
            status:
              completedCount === 0
                ? "not_started"
                : completedCount >= totalCount
                  ? "complete"
                  : "in_progress",
          };
        });

        // Compute aggregate progress
        const totalPipelines = pipelinesStatus.length;
        const completedPipelines = pipelinesStatus.filter(
          (p) => p.status === "complete",
        ).length;
        const inProgressPipelines = pipelinesStatus.filter(
          (p) => p.status === "in_progress",
        ).length;

        return new Response(
          JSON.stringify({
            client: {
              id: client.id,
              name: client.name,
              email: client.email,
              company: client.company || null,
              service: client.service,
              serviceSlug: client.service_slug,
              status: client.status,
            },
            pipeline: {
              currentStage: mappedStage,
              currentStatus: currentPipelineStatus,
              timeline,
              aggregate: {
                totalPipelines,
                completedPipelines,
                inProgressPipelines,
                notStartedPipelines:
                  totalPipelines - completedPipelines - inProgressPipelines,
                overallPercent:
                  totalPipelines > 0
                    ? Math.round(
                        (completedPipelines / totalPipelines) * 100,
                      )
                    : 0,
              },
              pipelines: pipelinesStatus,
            },
            updatedAt: String(client.updated_at),
            createdAt: String(client.created_at),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
