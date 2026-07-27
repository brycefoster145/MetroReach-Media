/**
 * Cron Health Monitoring Dashboard — GET /api/cron/status
 *
 * Live-updating dashboard showing cron health, last run stats,
 * queue depth, and failed posts. Auto-refreshes every 30 seconds.
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */
import { createFileRoute } from "@tanstack/react-router";
import postgres from "postgres";

const url = process.env.DATABASE_URL;

export const Route = createFileRoute("/api/cron/status")({
  server: {
    handlers: {
      GET: async () => {
        return renderDashboard();
      },
    },
  },
});

function statusBadge(secondsAgo: number): string {
  if (secondsAgo < 90) {
    return `<span style="color:#22c55e;font-weight:700;">🟢 Healthy</span>`;
  }
  if (secondsAgo < 300) {
    return `<span style="color:#f59e0b;font-weight:700;">🟡 Degraded</span>`;
  }
  return `<span style="color:#ef4444;font-weight:700;">🔴 Critical</span>`;
}

function statusColor(secondsAgo: number): string {
  if (secondsAgo < 90) return "#22c55e";
  if (secondsAgo < 300) return "#f59e0b";
  return "#ef4444";
}

async function renderDashboard(): Promise<Response> {
  if (!url) {
    return new Response(
      htmlPage(
        '<div style="color:#ef4444;text-align:center;padding:40px;">DATABASE_URL not configured</div>',
      ),
      { status: 500, headers: { "Content-Type": "text/html" } },
    );
  }

  const pg = postgres(url, {
    max: 2,
    idle_timeout: 10,
    connect_timeout: 10,
    ssl: "require",
  });

  try {
    // ── Last cron run ──
    const lastRunRows = await pg`
      SELECT id, posts_found, posts_processed, posts_succeeded, posts_failed, error, created_at
      FROM cron_runs
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const lastRun = lastRunRows[0] ?? null;

    // ── Last 10 runs ──
    const recentRuns = await pg`
      SELECT id, posts_found, posts_processed, posts_succeeded, posts_failed, error, created_at
      FROM cron_runs
      ORDER BY created_at DESC
      LIMIT 10
    `;

    // ── Queue depth ──
    const queueRows = await pg`
      SELECT COUNT(*)::int as cnt FROM scheduled_posts WHERE status = 'pending'
    `;
    const queueDepth = queueRows[0]?.cnt ?? 0;

    const dueRows = await pg`
      SELECT COUNT(*)::int as cnt FROM scheduled_posts
      WHERE status = 'pending' AND due_at <= NOW()
    `;
    const duePosts = dueRows[0]?.cnt ?? 0;

    // ── Failed Instagram posts ──
    const failedIgRows = await pg`
      SELECT id, content, posted_at
      FROM scheduled_posts
      WHERE status = 'failed' AND platform = 'instagram'
      ORDER BY posted_at DESC NULLS LAST
      LIMIT 5
    `;

    // ── Total posts ──
    const totalRows = await pg`
      SELECT COUNT(*)::int as cnt FROM scheduled_posts
    `;
    const totalPosts = totalRows[0]?.cnt ?? 0;

    const postedRows = await pg`
      SELECT COUNT(*)::int as cnt FROM scheduled_posts WHERE status = 'posted'
    `;
    const postedPosts = postedRows[0]?.cnt ?? 0;

    const failedTotalRows = await pg`
      SELECT COUNT(*)::int as cnt FROM scheduled_posts WHERE status = 'failed'
    `;
    const failedPosts = failedTotalRows[0]?.cnt ?? 0;

    // ── Compute status ──
    const now = new Date();
    let secondsAgo = 99999;
    let lastRunTime = "Never";
    if (lastRun) {
      const runTime = new Date(lastRun.created_at as string);
      secondsAgo = Math.floor((now.getTime() - runTime.getTime()) / 1000);
      lastRunTime = runTime.toLocaleString("en-US", {
        timeZone: "America/New_York",
        hour12: true,
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }) + " EST";
    }

    const badge = statusBadge(secondsAgo);
    const accentColor = statusColor(secondsAgo);

    // ── Build recent runs table rows ──
    const runsRows = recentRuns
      .map((r: any) => {
        const rt = new Date(r.created_at as string);
        const rtStr =
          rt.toLocaleString("en-US", {
            timeZone: "America/New_York",
            hour12: true,
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }) + " EST";
        const err =
          r.error && String(r.error).length > 0
            ? `<span style="color:#ef4444;" title="${esc(String(r.error))}">⚠</span>`
            : "";
        return `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #2a323c;">#${r.id}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #2a323c;">${rtStr}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #2a323c;text-align:center;">${r.posts_found}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #2a323c;text-align:center;">${r.posts_processed}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #2a323c;text-align:center;color:#22c55e;">${r.posts_succeeded}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #2a323c;text-align:center;color:#ef4444;">${r.posts_failed}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #2a323c;">${err}</td>
        </tr>`;
      })
      .join("");

    // ── Build failed IG posts rows ──
    const failedIgRowsHtml = failedIgRows
      .map((r: any) => {
        const content =
          String(r.content || "").substring(0, 120) +
          (String(r.content || "").length > 120 ? "…" : "");
        const pt = r.posted_at
          ? new Date(r.posted_at as string).toLocaleString("en-US", {
              timeZone: "America/New_York",
              hour12: true,
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }) + " EST"
          : "—";
        return `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #2a323c;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(String(r.content || ""))}">${esc(content)}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #2a323c;">${pt}</td>
        </tr>`;
      })
      .join("") ||
      '<tr><td colspan="2" style="padding:12px;color:#6b7280;">No failed Instagram posts 🎉</td></tr>';

    const body = `
    <div style="max-width:960px;margin:0 auto;padding:24px;">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;flex-wrap:wrap;gap:16px;">
        <div>
          <h1 style="margin:0;font-size:28px;font-weight:700;color:#f1f5f9;">Cron Health Monitor</h1>
          <p style="margin:4px 0 0;color:#94a3b8;font-size:14px;">MetroReach Digital — Posting Infrastructure</p>
        </div>
        <div style="font-size:14px;color:#64748b;">
          Auto-refresh: 30s &nbsp;|&nbsp; <span id="clock">—</span>
        </div>
      </div>

      <!-- Status Banner -->
      <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:24px;margin-bottom:24px;border-left:4px solid ${accentColor};">
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
          <div style="font-size:20px;">${badge}</div>
          <div style="color:#94a3b8;font-size:14px;">
            Last run: <span style="color:#e2e8f0;font-weight:600;">${lastRunTime}</span>
            ${secondsAgo < 99999 ? `&nbsp;(${secondsAgo}s ago)` : ""}
          </div>
        </div>
        ${
          lastRun && lastRun.error
            ? `<div style="margin-top:12px;padding:12px;background:#3b1111;border-radius:8px;color:#fca5a5;font-size:13px;font-family:monospace;">Last error: ${esc(String(lastRun.error))}</div>`
            : ""
        }
      </div>

      <!-- Stats Grid -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin-bottom:24px;">
        <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#f1f5f9;">${totalPosts}</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Total Posts</div>
        </div>
        <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#f59e0b;">${queueDepth}</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Pending</div>
        </div>
        <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:${duePosts > 0 ? '#ef4444' : '#22c55e'};">${duePosts}</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Due Now</div>
        </div>
        <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#22c55e;">${postedPosts}</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Posted</div>
        </div>
        <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#ef4444;">${failedPosts}</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Failed</div>
        </div>
      </div>

      <!-- Last Run Details -->
      ${
        lastRun
          ? `
      <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:20px;margin-bottom:24px;">
        <h3 style="margin:0 0 12px;color:#f1f5f9;font-size:16px;">Last Run Details</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;">
          <div><span style="color:#94a3b8;">Found:</span> <span style="color:#f1f5f9;font-weight:600;">${lastRun.posts_found}</span></div>
          <div><span style="color:#94a3b8;">Processed:</span> <span style="color:#f1f5f9;font-weight:600;">${lastRun.posts_processed}</span></div>
          <div><span style="color:#94a3b8;">Succeeded:</span> <span style="color:#22c55e;font-weight:600;">${lastRun.posts_succeeded}</span></div>
          <div><span style="color:#94a3b8;">Failed:</span> <span style="color:#ef4444;font-weight:600;">${lastRun.posts_failed}</span></div>
        </div>
      </div>`
          : ""
      }

      <!-- Recent Runs Table -->
      <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:20px;margin-bottom:24px;">
        <h3 style="margin:0 0 12px;color:#f1f5f9;font-size:16px;">Last 10 Cron Runs</h3>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;color:#e2e8f0;">
            <thead>
              <tr style="color:#94a3b8;text-align:left;">
                <th style="padding:6px 12px;border-bottom:2px solid #334155;">Run</th>
                <th style="padding:6px 12px;border-bottom:2px solid #334155;">Time (EST)</th>
                <th style="padding:6px 12px;border-bottom:2px solid #334155;text-align:center;">Found</th>
                <th style="padding:6px 12px;border-bottom:2px solid #334155;text-align:center;">Proc</th>
                <th style="padding:6px 12px;border-bottom:2px solid #334155;text-align:center;">✓</th>
                <th style="padding:6px 12px;border-bottom:2px solid #334155;text-align:center;">✗</th>
                <th style="padding:6px 12px;border-bottom:2px solid #334155;">Err</th>
              </tr>
            </thead>
            <tbody>
              ${runsRows || '<tr><td colspan="7" style="padding:12px;color:#6b7280;">No cron runs recorded yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Failed Instagram Posts -->
      <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:20px;margin-bottom:24px;">
        <h3 style="margin:0 0 12px;color:#f1f5f9;font-size:16px;">Failed Instagram Posts</h3>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;color:#e2e8f0;">
            <thead>
              <tr style="color:#94a3b8;text-align:left;">
                <th style="padding:6px 12px;border-bottom:2px solid #334155;">Content Preview</th>
                <th style="padding:6px 12px;border-bottom:2px solid #334155;">Failed At (EST)</th>
              </tr>
            </thead>
            <tbody>
              ${failedIgRowsHtml}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Footer -->
      <div style="text-align:center;padding:16px;color:#475569;font-size:12px;">
        MetroReach Digital Cron Monitor &middot; Updated every 30s &middot; ${new Date().toISOString()}
      </div>
    </div>`;

    return new Response(htmlPage(body), {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  } catch (err: any) {
    return new Response(
      htmlPage(
        `<div style="color:#ef4444;text-align:center;padding:40px;">Database error: ${esc(err.message)}</div>`,
      ),
      { status: 500, headers: { "Content-Type": "text/html" } },
    );
  } finally {
    await pg.end();
  }
}

function htmlPage(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cron Health — MetroReach Digital</title>
  <meta http-equiv="refresh" content="30">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      background: #12171d;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    a { color: #008fff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #12171d; }
    ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
  </style>
  <script>
    // Live clock
    function updateClock() {
      const now = new Date();
      document.getElementById('clock').textContent = now.toLocaleTimeString('en-US', {timeZone:'America/New_York', hour12:true, hour:'2-digit', minute:'2-digit', second:'2-digit'}) + ' EST';
    }
    updateClock();
    setInterval(updateClock, 1000);
  </script>
</head>
<body>
${body}
</body>
</html>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
