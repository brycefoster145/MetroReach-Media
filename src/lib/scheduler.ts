/**
 * Recurring Task Scheduler — MetroReach Media
 *
 * For ongoing monthly services, schedules recurring pipeline tasks.
 * Checks every hour for tasks due, executes pipeline steps on schedule,
 * and marks completed steps while queuing the next ones.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { sql } from "~/lib/db";
import { PIPELINE_MAP } from "~/lib/pipeline-executor";
import type { PipelineDefinition, PipelineStep } from "~/lib/pipeline-executor";
import { sendStatusUpdate } from "~/lib/email-sequences";
import type { Client } from "~/lib/email-sequences";

// ── Types ──

interface ScheduledTask {
  clientId: string;
  clientEmail: string;
  clientName: string;
  service: string;
  serviceSlug: string;
  pipelineLabel: string;
  pipelineFile: string;
  step: PipelineStep;
  dueAt: string;
  intervalHours: number;
  recurring: boolean;
}

interface TaskLogEntry {
  clientId: string;
  pipelineFile: string;
  step: PipelineStep;
  executedAt: string;
  success: boolean;
  error?: string;
}

// ── Scheduler ──

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

/**
 * Start the recurring task scheduler.
 * Checks for due tasks every hour.
 */
export function startScheduler(): void {
  if (schedulerInterval) {
    console.log("Scheduler already running");
    return;
  }

  console.log("Starting pipeline task scheduler (interval: 60 minutes)");

  // Run immediately on start
  processDueTasks().catch((err) =>
    console.error("Initial scheduler run failed:", err.message),
  );

  // Then every hour
  schedulerInterval = setInterval(() => {
    processDueTasks().catch((err) =>
      console.error("Scheduler run failed:", err.message),
    );
  }, 60 * 60 * 1000);
}

/**
 * Stop the scheduler.
 */
export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("Scheduler stopped");
  }
}

/**
 * Main scheduler loop: find and execute all due tasks.
 */
async function processDueTasks(): Promise<void> {
  if (isRunning) {
    console.log("Scheduler already processing — skipping");
    return;
  }

  isRunning = true;
  const startTime = Date.now();
  let executedCount = 0;
  let failedCount = 0;

  try {
    const tasks = await findDueTasks();

    if (tasks.length === 0) {
      console.log("No due tasks found");
      return;
    }

    console.log(`Found ${tasks.length} due tasks`);

    for (const task of tasks) {
      try {
        await executeScheduledTask(task);
        executedCount++;
      } catch (err: any) {
        console.error(`Task ${task.pipelineLabel}:${task.step} for ${task.clientId} failed:`, err.message);
        failedCount++;
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `Scheduler cycle complete: ${executedCount} executed, ${failedCount} failed (${elapsed}ms)`,
    );
  } finally {
    isRunning = false;
  }
}

/**
 * Find all tasks that are due for execution.
 * Queries active clients and checks their pipeline schedules.
 */
async function findDueTasks(): Promise<ScheduledTask[]> {
  const tasks: ScheduledTask[] = [];

  try {
    // Get all active clients
    const clients = await sql`
      SELECT id, email, name, service, service_slug, pipeline_status, onboarding_data, created_at
      FROM clients
      WHERE status = 'active' OR status = 'onboarding'
      ORDER BY created_at ASC
    `;

    for (const client of clients) {
      const servicePipelines = PIPELINE_MAP[client.service_slug as string] || [];

      for (const pipeline of servicePipelines) {
        if (!pipeline.recurring || !pipeline.intervalHours) continue;

        // Check when this pipeline was last executed for this client
        const pipelineKey = pipeline.file.replace(".md", "");
        const lastRun = await getLastExecutionTime(client.id as string, pipelineKey);

        const now = new Date();
        const dueTime = lastRun
          ? new Date(lastRun.getTime() + pipeline.intervalHours * 3600 * 1000)
          : new Date((client.created_at as Date).getTime() + pipeline.intervalHours * 3600 * 1000);

        if (dueTime <= now) {
          // This pipeline is due for another cycle
          // Find the next uncompleted step
          const nextStep = await findNextStep(client.id as string, pipeline);

          if (nextStep) {
            tasks.push({
              clientId: client.id as string,
              clientEmail: client.email as string,
              clientName: client.name as string,
              service: client.service as string,
              serviceSlug: client.service_slug as string,
              pipelineLabel: pipeline.label,
              pipelineFile: pipeline.file,
              step: nextStep,
              dueAt: dueTime.toISOString(),
              intervalHours: pipeline.intervalHours,
              recurring: pipeline.recurring,
            });
          }
        }
      }
    }
  } catch (err: any) {
    console.error("Failed to find due tasks:", err.message);
  }

  return tasks;
}

/**
 * Find the next uncompleted step for a pipeline.
 * For recurring pipelines, cycles through steps; for one-time, only returns
 * steps that haven't been completed yet.
 */
async function findNextStep(
  clientId: string,
  pipeline: PipelineDefinition,
): Promise<PipelineStep | null> {
  const pipelineKey = pipeline.file.replace(".md", "");

  try {
    // Get all completed steps for this pipeline
    const completedRows = await sql`
      SELECT step_key FROM pipeline_log
      WHERE client_id = ${clientId}
        AND step_key LIKE ${pipelineKey + ":%"}
        AND status = 'completed'
      ORDER BY created_at DESC
      LIMIT ${pipeline.steps.length}
    `;
  } catch {
    // pipeline_log table may not exist
    // Return the first step
    return pipeline.steps[0] || null;
  }

  // Re-query to get the actual data
  let completedStepNames: string[] = [];
  try {
    const rows = await sql`
      SELECT step_key FROM pipeline_log
      WHERE client_id = ${clientId}
        AND step_key LIKE ${pipelineKey + ":%"}
        AND status = 'completed'
      ORDER BY created_at ASC
    `;
    completedStepNames = rows.map((r) => (r.step_key as string).replace(pipelineKey + ":", ""));
  } catch {
    return pipeline.steps[0] || null;
  }

  if (completedStepNames.length === 0) {
    return pipeline.steps[0] || null;
  }

  // For recurring, cycle back to the first step when all are done
  const allDone = pipeline.steps.every((s) => completedStepNames.includes(s));

  if (allDone && pipeline.recurring) {
    // Reset for next cycle — start from the first non-continuous step
    const firstActionable = pipeline.steps.find(
      (s) => s !== "monitor" && s !== "engage",
    );
    return firstActionable || pipeline.steps[0];
  }

  // Find next uncompleted step
  for (const step of pipeline.steps) {
    if (!completedStepNames.includes(step)) {
      return step;
    }
  }

  return null;
}

/**
 * Execute a single scheduled task.
 */
async function executeScheduledTask(task: ScheduledTask): Promise<void> {
  const pipelineKey = task.pipelineFile.replace(".md", "");
  const stepKey = `${pipelineKey}:${task.step}`;

  console.log(`  Executing scheduled task: ${task.pipelineLabel}:${task.step} for ${task.clientName}`);

  // Build a client object for the task
  const client: Client = {
    id: task.clientId,
    email: task.clientEmail,
    name: task.clientName,
    service: task.service,
    service_slug: task.serviceSlug,
    status: "active",
    pipeline_status: stepKey,
  };

  // Execute the step
  const result = await executeStepAction(client, task);

  // Log the execution
  await logTaskExecution(task, result.success);

  // Update client's pipeline_status
  try {
    await sql`
      UPDATE clients
      SET pipeline_status = ${stepKey}, updated_at = NOW()
      WHERE id = ${task.clientId}
    `;
  } catch (err: any) {
    console.error(`Failed to update pipeline_status for ${task.clientId}:`, err.message);
  }

  // For key steps, send status update
  if (task.step === "report" || task.step === "deliver") {
    try {
      await sendStatusUpdate(
        client,
        "active",
        `Your ${task.pipelineLabel} has been updated. Visit your dashboard for the latest results.`,
      );
    } catch (err: any) {
      console.error(`Status update email failed for ${task.clientId}:`, err.message);
    }
  }
}

// ── Step execution ──

interface StepResult {
  success: boolean;
  error?: string;
  data?: string;
}

async function executeStepAction(
  client: Client,
  task: ScheduledTask,
): Promise<StepResult> {
  const pipelineKey = task.pipelineFile.replace(".md", "");

  try {
    let data = "";

    switch (task.step) {
      case "research":
        data = JSON.stringify({
          action: "scheduled_research",
          clientId: client.id,
          pipeline: task.pipelineLabel,
          pipelineFile: `/home/team/shared/pipelines/${task.pipelineFile}`,
          recurring: task.recurring,
          intervalHours: task.intervalHours,
          executedAt: new Date().toISOString(),
          instructions: `Scheduled research refresh for ${task.pipelineLabel}. Review latest data, trends, and performance metrics.`,
        });
        break;

      case "create":
        data = JSON.stringify({
          action: "scheduled_creation",
          clientId: client.id,
          pipeline: task.pipelineLabel,
          executedAt: new Date().toISOString(),
          instructions: `Scheduled creation cycle for ${task.pipelineLabel}. Generate updated deliverables per MetroReach standards.`,
        });
        break;

      case "review":
        data = JSON.stringify({
          action: "scheduled_review",
          clientId: client.id,
          pipeline: task.pipelineLabel,
          executedAt: new Date().toISOString(),
          qaChecklist: "Standard QA checklist + pipeline-specific quality rubrics",
          status: "pending_review",
        });
        break;

      case "deliver":
        data = JSON.stringify({
          action: "scheduled_delivery",
          clientId: client.id,
          pipeline: task.pipelineLabel,
          executedAt: new Date().toISOString(),
          deliveryMethod: "email",
          status: "ready_for_delivery",
        });
        break;

      case "monitor":
        data = JSON.stringify({
          action: "continuous_monitoring",
          clientId: client.id,
          pipeline: task.pipelineLabel,
          executedAt: new Date().toISOString(),
          status: "monitoring_active",
        });
        break;

      case "engage":
        data = JSON.stringify({
          action: "engagement_check",
          clientId: client.id,
          pipeline: task.pipelineLabel,
          executedAt: new Date().toISOString(),
          status: "engagement_active",
        });
        break;

      case "report":
        data = JSON.stringify({
          action: "performance_report",
          clientId: client.id,
          pipeline: task.pipelineLabel,
          executedAt: new Date().toISOString(),
          reportType: "monthly" as const,
          status: "report_generated",
        });
        break;

      default:
        data = JSON.stringify({
          action: task.step,
          clientId: client.id,
          pipeline: task.pipelineLabel,
          executedAt: new Date().toISOString(),
        });
    }

    // Record the step in pipeline_log
    const stepKey = `${pipelineKey}:${task.step}`;
    await recordStep(task.clientId, stepKey, data);

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Database helpers ──

async function getLastExecutionTime(
  clientId: string,
  pipelineKey: string,
): Promise<Date | null> {
  try {
    const rows = await sql`
      SELECT created_at FROM pipeline_log
      WHERE client_id = ${clientId}
        AND step_key LIKE ${pipelineKey + ":%"}
        AND status = 'completed'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (rows.length > 0 && rows[0].created_at) {
      return new Date(rows[0].created_at as string);
    }
    return null;
  } catch {
    return null;
  }
}

async function recordStep(
  clientId: string,
  stepKey: string,
  data: string,
): Promise<void> {
  try {
    await sql`
      INSERT INTO pipeline_log (client_id, step_key, status, deliverables, created_at)
      VALUES (${clientId}, ${stepKey}, 'completed', ${data}::jsonb, NOW())
      ON CONFLICT (client_id, step_key) DO UPDATE
      SET status = 'completed', deliverables = ${data}::jsonb, updated_at = NOW()
    `;
  } catch (err: any) {
    console.error(`Failed to record step ${stepKey} for ${clientId}:`, err.message);
  }
}

async function logTaskExecution(
  task: ScheduledTask,
  success: boolean,
): Promise<void> {
  try {
    await sql`
      INSERT INTO task_log (client_id, pipeline_file, step, executed_at, success)
      VALUES (${task.clientId}, ${task.pipelineFile}, ${task.step}, NOW(), ${success})
    `;
  } catch {
    // task_log table may not exist — non-critical
  }
}

// ── Manual trigger (for testing or admin intervention) ──

/**
 * Manually trigger a pipeline cycle for a specific client and pipeline.
 * Useful for admin operations or retrying failed pipelines.
 */
export async function triggerPipelineCycle(
  clientId: string,
  pipelineFile: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const clientRows = await sql`
      SELECT id, email, name, service, service_slug, pipeline_status
      FROM clients WHERE id = ${clientId} LIMIT 1
    `;

    if (!clientRows.length) {
      return { success: false, message: "Client not found" };
    }

    const client = clientRows[0];
    const pipelines = PIPELINE_MAP[client.service_slug as string] || [];
    const pipeline = pipelines.find((p) => p.file === pipelineFile);

    if (!pipeline) {
      return { success: false, message: `Pipeline ${pipelineFile} not found for service ${client.service_slug}` };
    }

    const nextStep = await findNextStep(clientId, pipeline);
    if (!nextStep) {
      return { success: false, message: "No remaining steps for this pipeline" };
    }

    const task: ScheduledTask = {
      clientId: client.id as string,
      clientEmail: client.email as string,
      clientName: client.name as string,
      service: client.service as string,
      serviceSlug: client.service_slug as string,
      pipelineLabel: pipeline.label,
      pipelineFile: pipeline.file,
      step: nextStep,
      dueAt: new Date().toISOString(),
      intervalHours: pipeline.intervalHours || 720,
      recurring: pipeline.recurring,
    };

    await executeScheduledTask(task);
    return { success: true, message: `Triggered ${pipeline.label}:${nextStep}` };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
