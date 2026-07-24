/**
 * POST /api/client/message — Send message from client to team
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { getClientFromRequest, generateId } from "~/lib/client-auth";
import { sql } from "~/lib/db";
import { sendEmail } from "~/lib/email";

export const Route = createFileRoute("/api/client/message")({
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

        let body: { message: string };
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const { message } = body;
        if (!message || typeof message !== "string" || !message.trim()) {
          return new Response(
            JSON.stringify({ error: "Message required" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const msgId = generateId("msg");
        const trimmed = message.trim();

        await sql`
          INSERT INTO client_messages (id, client_id, direction, message)
          VALUES (${msgId}, ${client.sub}, 'client_to_team', ${trimmed})
        `;

        // Get client info for notification
        const rows = await sql`
          SELECT name, email FROM clients WHERE id = ${client.sub} LIMIT 1
        `;

        const clientName = (rows[0]?.name as string) || "Client";
        const clientEmail = (rows[0]?.email as string) || client.email;

        // Send notification to team
        sendEmail({
          to: "bryce@metroreachagency.com",
          from: "support@metroreachagency.com",
          subject: `New message from ${clientName}`,
          body: `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px;">
  <p style="font-size:13px;font-weight:600;color:#3B82F6;letter-spacing:0.05em;text-transform:uppercase;">MetroReach Digital</p>
  <h2 style="color:#1a1a1a;font-size:20px;font-weight:700;">New Client Message</h2>
  <p style="font-size:15px;color:#374151;"><strong>${clientName}</strong> (${clientEmail})</p>
  <div style="background:#f5f3ff;padding:16px;border-radius:8px;margin:16px 0;">
    <p style="margin:0;font-size:15px;color:#374151;">${message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
  </div>
  <p style="font-size:13px;color:#6b7280;">Reply directly to ${clientEmail}</p>
</body>
</html>`.trim(),
          replyTo: clientEmail,
        }).catch((e) => console.error("Message notification email failed:", e.message));

        return new Response(
          JSON.stringify({ success: true, id: msgId, created_at: new Date().toISOString() }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
