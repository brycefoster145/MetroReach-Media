/**
 * POST /api/client/auth — Magic link authentication
 *
 * 1. Client submits email
 * 2. We look up the client in the `clients` table
 * 3. Generate a signed JWT
 * 4. Send magic link email
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { createClientToken } from "~/lib/client-auth";
import { sendEmail } from "~/lib/email";
import { sql } from "~/lib/db";
import { rateLimit, getClientIp } from "~/lib/rate-limit";
import { getSiteUrl } from "~/lib/site-url";

function magicLinkEmail(clientName: string, magicUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px;background:#fafafa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
    <tr>
      <td style="padding:32px 32px 8px;">
        <p style="font-size:13px;font-weight:600;color:#3B82F6;letter-spacing:0.05em;text-transform:uppercase;margin:0;">MetroReach Media</p>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 32px 32px;">
        <h2 style="color:#1a1a1a;font-size:22px;font-weight:700;margin:0 0 16px;line-height:1.3;">Your Client Portal Login</h2>
        <p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">
          Hi ${escapeHtml(clientName)},
        </p>
        <p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">
          Click the button below to access your MetroReach Media client portal. This link expires in 1 hour.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${magicUrl}" style="display:inline-block;background:#3B82F6;color:#ffffff;padding:14px 32px;border-radius:9999px;text-decoration:none;font-weight:600;font-size:15px;">Access Your Portal →</a>
        </div>
        <p style="font-size:13px;line-height:1.6;color:#6b7280;margin:0 0 16px;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px;background:#0D1117;font-size:13px;color:#94A3B8;border-top:1px solid #1E293B;">
        <p style="margin:0 0 4px;">MetroReach Media — Premium Social Media Marketing</p>
        <p style="margin:0;">Need help? Reply to this email.</p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export const Route = createFileRoute("/api/client/auth")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Rate limiting
        const ip = getClientIp(request);
        const rl = rateLimit(`client-auth:${ip}`, 3, 60_000);
        if (!rl.allowed) {
          return new Response(
            JSON.stringify({ error: "Too many requests. Please wait a moment." }),
            { status: 429, headers: { "Content-Type": "application/json" } },
          );
        }

        let body: { email: string };
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const { email } = body;
        if (!email || typeof email !== "string" || !email.includes("@")) {
          return new Response(
            JSON.stringify({ error: "Valid email required" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // Look up client
        const rows = await sql`
          SELECT id, email, name FROM clients WHERE email = ${email.toLowerCase().trim()} LIMIT 1
        `;

        // Always return success to prevent email enumeration
        if (rows.length === 0) {
          return new Response(
            JSON.stringify({ success: true, message: "If that email is registered, you'll receive a login link shortly." }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        const client = rows[0];
        const token = createClientToken(client.id as string, client.email as string);
        const baseUrl = getSiteUrl();
        const magicUrl = `${baseUrl}/api/client/verify?token=${encodeURIComponent(token)}`;

        // Send magic link email (non-blocking)
        sendEmail({
          to: client.email as string,
          from: "bryce@metroreachagency.com",
          subject: "Your MetroReach Media Client Portal Login",
          body: magicLinkEmail((client.name as string) || "there", magicUrl),
        }).catch((e) => console.error("Magic link email failed:", e.message));

        return new Response(
          JSON.stringify({ success: true, message: "Login link sent to your email." }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
