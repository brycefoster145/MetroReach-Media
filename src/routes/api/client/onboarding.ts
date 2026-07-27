/**
 * POST /api/client/onboarding — Submit onboarding data
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { getClientFromRequest } from "~/lib/client-auth";
import { sql } from "~/lib/db";
import { sendEmail } from "~/lib/email";
import { resolveAttribution, writeConversionEvent } from "~/lib/attribution";

export const Route = createFileRoute("/api/client/onboarding")({
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

        let body: {
          platformUrls?: Record<string, string>;
          brandInfo?: Record<string, string>;
          goals?: string[];
        };
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // Merge with existing onboarding data
        const existing = await sql`
          SELECT onboarding_data, name FROM clients WHERE id = ${client.sub} LIMIT 1
        `;

        const current = (existing[0]?.onboarding_data as Record<string, unknown>) || {};
        const merged = {
          ...current,
          ...body,
          submitted_at: new Date().toISOString(),
        };

        await sql`
          UPDATE clients
          SET onboarding_data = ${JSON.stringify(merged)}::jsonb, updated_at = NOW()
          WHERE id = ${client.sub}
        `;

        const clientName = (existing[0]?.name as string) || "Client";

        // ── Write conversion event if this is the FIRST onboarding submission ──
        const isFirstSubmission = !current || Object.keys(current).length === 0;
        if (isFirstSubmission) {
          resolveAttribution(request)
            .then((attribution) => {
              attribution.client_id = client.sub;
              return writeConversionEvent(
                attribution,
                "onboarding_complete",
              );
            })
            .catch((e) =>
              console.error("Onboarding conversion event write failed:", e.message),
            );
        }

        // Notify team
        sendEmail({
          to: "bryce@metroreachagency.com",
          from: "support@metroreachagency.com",
          subject: `Onboarding update from ${clientName}`,
          body: `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px;">
  <p style="font-size:13px;font-weight:600;color:#3B82F6;letter-spacing:0.05em;text-transform:uppercase;">MetroReach Media</p>
  <h2 style="color:#1a1a1a;font-size:20px;font-weight:700;">Onboarding Update Received</h2>
  <p style="font-size:15px;color:#374151;"><strong>${clientName}</strong> submitted onboarding data.</p>
  <p style="font-size:14px;color:#6b7280;">Log in to the dashboard to review.</p>
</body>
</html>`.trim(),
        }).catch((e) => console.error("Onboarding notification failed:", e.message));

        return new Response(
          JSON.stringify({ success: true, data: merged }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
