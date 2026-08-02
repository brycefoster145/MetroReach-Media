/**
 * Pipeline Task Auto-Delegation Cron — GET/POST /api/cron/delegate-tasks
 *
 * Closes the purchase-to-fulfillment loop: every task sitting in the
 * pipeline_tasks table with status `pending` is claimed atomically
 * (pending → in_progress) and turned into a delegation brief written to
 * /home/team/shared/tasks/claimed/{taskId}.md for the team lead to pick up
 * on next activation and formally delegate to the assigned team member.
 *
 * Runs every 5 minutes via Vercel cron (see vercel.json).
 * Protected by the X-Cron-Secret header matching the CRON_SECRET env var
 * (check is skipped when CRON_SECRET is not set, mirroring the other cron
 * endpoints so local/dev testing stays easy).
 *
 * Notes:
 * - `assigned_roles` on the task row (populated from DELIVERABLE_TEAM in
 *   src/lib/pipeline-executor.ts) is authoritative. A fallback routing
 *   table keyed by deliverable_type covers rows written without roles.
 * - The shared-tasks path only exists on the team sandbox. On serverless
 *   (Vercel) the file write is best-effort: failures are logged and the
 *   full delegation brief is still returned in the response body so the
 *   caller can persist it. The DB row's task_brief is the source of truth.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */
import { createFileRoute } from "@tanstack/react-router";
import { mkdir, writeFile } from "node:fs/promises";
import { getPendingTasks, claimTask, type PipelineTask } from "~/lib/pipeline-executor";

const CLAIMED_TASKS_DIR = "/home/team/shared/tasks/claimed";

/**
 * Fallback routing table: deliverable type → team member(s).
 * Used only when a task row has no assigned_roles.
 * Content Strategist leads strategy/calendar work, Copywriter owns copy,
 * Designer owns visuals — matching the DELIVERABLE_TEAM map.
 */
const ROLE_BY_DELIVERABLE_TYPE: Record<string, string[]> = {
  "content-calendar": ["Content Strategist"],
  "content-deliverable": ["Content Strategist", "Copywriter", "Designer"],
  "strategy-document": ["Content Strategist", "Copywriter", "Designer"],
  copywriting: ["Copywriter"],
  design: ["Designer"],
  "ongoing-management": ["Content Strategist", "Copywriter", "Designer"],
  advertising: ["Paid Ads Specialist", "Content Strategist", "Designer"],
  "community-management": ["Content Strategist"],
  "setup-reporting": ["Analytics & Watchdog", "Content Strategist", "Engineer"],
};

function resolveAssignedRoles(task: PipelineTask): string[] {
  if (Array.isArray(task.assigned_roles) && task.assigned_roles.length > 0) {
    return task.assigned_roles;
  }
  return ROLE_BY_DELIVERABLE_TYPE[task.deliverable_type] ?? ["Content Strategist"];
}

/** Build the delegation brief: full task brief + assigned team + instructions. */
function buildDelegationBrief(task: PipelineTask, roles: string[]): string {
  return [
    `# Delegated Task: ${task.service_name}`,
    "",
    `> **Task ID:** \`${task.id}\`  `,
    `> **Deliverable type:** ${task.deliverable_type}  `,
    `> **Client:** ${task.client_name}${task.company ? ` (${task.company})` : ""}  `,
    `> **Deadline:** ${task.deadline}  `,
    `> **Status:** in_progress (claimed by auto-delegation cron)`,
    "",
    "---",
    "",
    "## Assigned Team",
    roles.map((role) => `- **${role}**`).join("\n"),
    "",
    "## Original Task Brief",
    "",
    task.task_brief,
    "",
    "---",
    "",
    "## Instructions",
    `- The team lead reviews this brief and formally delegates to: ${roles.join(", ")}.`,
    "- The assignee produces the deliverable following the Original Task Brief above.",
    `- On completion, email the deliverable to the client at ${task.client_email} before the deadline.`,
    "- Update the task lifecycle: mark this task `delivered` in the pipeline_tasks table once the deliverable is sent.",
    "- LOCKED-IN RULES: 100% verifiable client facts only (no fabricated statistics); premium human-written copy (never mention AI or automation); brand must appear as \"MetroReach Media\" everywhere.",
    "",
    `*Claimed by MetroReach Media delegate-tasks cron — ${new Date().toISOString()}*`,
  ].join("\n");
}

interface DelegationResult {
  task_id: string;
  service_name: string;
  deliverable_type: string;
  roles: string[];
  brief_written: boolean;
  brief_path: string;
  brief: string;
}

interface DelegationError {
  task_id: string;
  error: string;
}

async function runDelegation(): Promise<{
  pending_count: number;
  claimed_count: number;
  delegated: DelegationResult[];
  errors: DelegationError[];
}> {
  const pending = await getPendingTasks();
  const delegated: DelegationResult[] = [];
  const errors: DelegationError[] = [];

  for (const task of pending) {
    const claimed = await claimTask(task.id);
    if (!claimed) {
      // Another runner already claimed it — not a failure, just skip.
      errors.push({ task_id: task.id, error: "claim failed — task no longer pending" });
      continue;
    }

    const roles = resolveAssignedRoles(task);
    const brief = buildDelegationBrief(task, roles);
    const briefPath = `${CLAIMED_TASKS_DIR}/${task.id}.md`;
    let briefWritten = false;
    try {
      await mkdir(CLAIMED_TASKS_DIR, { recursive: true });
      await writeFile(briefPath, brief, "utf8");
      briefWritten = true;
    } catch (err: any) {
      // Serverless filesystems are read-only outside /tmp — the DB task_brief
      // remains the source of truth and the brief is in the response body.
      console.error(`[cron/delegate-tasks] Brief write failed for ${task.id}: ${err?.message ?? err}`);
    }

    console.log(
      `[cron/delegate-tasks] Delegated task ${task.id} (${task.service_name}, ${task.deliverable_type}) → ${roles.join(", ")}; brief_written=${briefWritten}`,
    );

    delegated.push({
      task_id: task.id,
      service_name: task.service_name,
      deliverable_type: task.deliverable_type,
      roles,
      brief_written: briefWritten,
      brief_path: briefPath,
      brief,
    });
  }

  return { pending_count: pending.length, claimed_count: delegated.length, delegated, errors };
}

async function runHandler(request: Request) {
  // ── Auth check: X-Cron-Secret header must match CRON_SECRET ──
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("x-cron-secret") ?? "";
    if (authHeader !== cronSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — invalid or missing X-Cron-Secret" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  try {
    const result = await runDelegation();
    return new Response(
      JSON.stringify(
        {
          status: "ok",
          server_time_utc: new Date().toISOString(),
          ...result,
        },
        null,
        2,
      ),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[cron/delegate-tasks] Error:", err?.message ?? err);
    return new Response(
      JSON.stringify({ status: "error", error: "delegate-tasks cron failed", detail: err?.message ?? String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export const Route = createFileRoute("/api/cron/delegate-tasks")({
  server: {
    handlers: {
      GET: async ({ request }) => runHandler(request),
      POST: async ({ request }) => runHandler(request),
    },
  },
});
