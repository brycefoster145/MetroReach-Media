/**
 * POST /api/client/approve — Approve or request changes on a deliverable
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { getClientFromRequest } from "~/lib/client-auth";
import { sql } from "~/lib/db";
import { sendEmail } from "~/lib/email";

function approvalNotificationHtml(clientName: string, title: string, approved: boolean, notes?: string): string {
  const statusLabel = approved ? "Approved" : "Changes Requested";
  const statusColor = approved ? "#06D6A0" : "#F59E0B";

  return `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px;background:#fafafa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
    <tr>
      <td style="padding:32px 32px 8px;">
        <p style="font-size:13px;font-weight:600;color:#3B82F6;letter-spacing:0.05em;text-transform:uppercase;margin:0;">MetroReach Digital</p>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 32px 32px;">
        <h2 style="color:#1a1a1a;font-size:22px;font-weight:700;margin:0 0 16px;line-height:1.3;">Deliverable ${escapeHtml(statusLabel)}</h2>
        <p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">
          ${escapeHtml(clientName)} ${approved ? "approved" : "requested changes on"}:
        </p>
        <div style="background:#f5f3ff;border-radius:12px;padding:20px;margin:16px 0;">
          <p style="font-size:16px;font-weight:600;color:#1a1a1a;margin:0 0 4px;">${escapeHtml(title)}</p>
          <p style="font-size:14px;font-weight:700;color:${statusColor};margin:0;">${statusLabel}</p>
        </div>
        ${notes ? `<p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;"><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ""}
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px;background:#0D1117;font-size:13px;color:#94A3B8;border-top:1px solid #1E293B;">
        <p style="margin:0;">MetroReach Digital — Premium Social Media Marketing</p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export const Route = createFileRoute("/api/client/approve")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const client = getClientFromRequest(request);
        if (!client) {
          return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }

        let body: { deliverableId: string; approved: boolean; notes?: string };
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const { deliverableId, approved, notes } = body;
        if (!deliverableId) {
          return new Response(
            JSON.stringify({ error: "deliverableId required" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // Verify deliverable belongs to this client
        const rows = await sql`
          SELECT id, title FROM deliverables
          WHERE id = ${deliverableId} AND client_id = ${client.sub}
          LIMIT 1
        `;

        if (rows.length === 0) {
          return new Response(
            JSON.stringify({ error: "Deliverable not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } },
          );
        }

        const newStatus = approved ? "approved" : "changes_requested";

        await sql`
          UPDATE deliverables
          SET status = ${newStatus}, notes = ${notes || null}
          WHERE id = ${deliverableId}
        `;

        // Get client name for notification
        const clientRows = await sql`
          SELECT name FROM clients WHERE id = ${client.sub} LIMIT 1
        `;
        const clientName = (clientRows[0]?.name as string) || "Client";

        // Send notification to team (non-blocking)
        sendEmail({
          to: "bryce@metroreachagency.com",
          from: "support@metroreachagency.com",
          subject: `Deliverable ${approved ? "Approved" : "Changes Requested"}: ${rows[0].title}`,
          body: approvalNotificationHtml(clientName, rows[0].title as string, approved, notes),
        }).catch((e) => console.error("Approval notification email failed:", e.message));

        return new Response(
          JSON.stringify({ success: true, status: newStatus }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
