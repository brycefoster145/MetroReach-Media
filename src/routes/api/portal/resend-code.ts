/**
 * POST /api/portal/resend-code — Send a password setup link to the client's email
 *
 * Used by the "Forgot password?" flow. If the email matches a client, a
 * fresh one-time portal_token is generated and a link to
 * /portal?token=XXX is emailed. That link opens the "Set your password"
 * form (account setup for new clients, password reset for existing ones).
 *
 * The response is deliberately generic — it never reveals whether an
 * account exists for the submitted email.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { checkCsrf } from "~/lib/client-auth";
import { sql } from "~/lib/db";
import { rateLimit, getClientIp } from "~/lib/rate-limit";
import { sendEmail } from "~/lib/email";
import { getSiteUrl } from "~/lib/site-url";
import { randomBytes } from "node:crypto";

const FROM_ADDRESS = "support@metroreachagency.com";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setupEmailShell(title: string, content: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px;background:#fafafa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
    <tr>
      <td style="padding:32px 32px 8px;">
        <p style="font-size:13px;font-weight:600;color:#7c3aed;letter-spacing:0.05em;text-transform:uppercase;margin:0;">MetroReach Media</p>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 32px 32px;">
        <h2 style="color:#1a1a1a;font-size:22px;font-weight:700;margin:0 0 16px;line-height:1.3;">${title}</h2>
        ${content}
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px;background:#f5f3ff;font-size:13px;color:#6b7280;border-top:1px solid #e5e0f0;">
        <p style="margin:0 0 4px;">MetroReach Media — Premium Social Media Marketing</p>
        <p style="margin:0;">Need help? Reply to this email or reach us at ${FROM_ADDRESS}</p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export const Route = createFileRoute("/api/portal/resend-code")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Rate limit: 3 attempts per IP per 5 minutes
          const ip = getClientIp(request);
          const rl = rateLimit(`resend-code:${ip}`, 3, 300_000);
          if (!rl.allowed) {
            return new Response(
              JSON.stringify({ error: "Too many attempts. Please wait before trying again." }),
              { status: 429, headers: { "Content-Type": "application/json" } },
            );
          }

          // CSRF protection
          if (!checkCsrf(request)) {
            return new Response(
              JSON.stringify({ error: "Invalid request" }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          }

          let body: { email?: string };
          try {
            body = await request.json();
          } catch {
            return new Response(
              JSON.stringify({ error: "Invalid JSON" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const email =
            typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
          if (!email || !email.includes("@") || email.length > 254) {
            return new Response(
              JSON.stringify({ error: "Please provide a valid email address." }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          // Look up client by email
          const rows = await sql`
            SELECT id, email, name FROM clients
            WHERE email = ${email}
            LIMIT 1
          `;

          // Generic success regardless — never reveal account existence.
          const genericSuccess = JSON.stringify({
            success: true,
            message:
              "If an account exists for that email, we've sent you a link to set up your password.",
          });

          if (rows.length === 0) {
            return new Response(genericSuccess, {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          const client = rows[0];

          // Generate a fresh one-time setup token
          const newToken = `mr-${randomBytes(16).toString("hex")}`;

          await sql`
            UPDATE clients
            SET portal_token = ${newToken}, updated_at = NOW()
            WHERE id = ${client.id}
          `;

          const setupUrl = `${getSiteUrl()}/portal?token=${encodeURIComponent(newToken)}`;

          const content = `
<p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">
  Hi ${escapeHtml(String(client.name))},
</p>
<p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">
  We received a request to set up or reset the password for your MetroReach Media client portal.
</p>
<p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">
  Click the button below to choose a new password. This link is single-use and expires once used.
</p>
<div style="text-align:center;margin:24px 0;">
  <a href="${setupUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;padding:14px 32px;border-radius:9999px;text-decoration:none;font-weight:600;font-size:15px;">Set Your Password →</a>
</div>
<p style="font-size:14px;line-height:1.6;color:#6b7280;margin:0 0 16px;">
  If the button doesn't work, copy and paste this link into your browser:
</p>
<p style="font-size:13px;line-height:1.6;color:#6b7280;margin:0;word-break:break-all;">
  ${setupUrl}
</p>`;

          const emailResult = await sendEmail({
            to: String(client.email),
            from: FROM_ADDRESS,
            subject: "Set up your password — MetroReach Media Client Portal",
            body: setupEmailShell("Set up your password", content),
          });

          if (!emailResult.success) {
            // Log the delivery failure but keep the response generic.
            console.error(
              `[portal resend-code] email delivery failed for ${client.email}: ${emailResult.error}`,
            );
          }

          return new Response(genericSuccess, {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("[portal resend-code] error:", err);
          return new Response(
            JSON.stringify({ error: "Something went wrong. Please try again." }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
