import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { randomBytes } from "node:crypto";
import { sql } from "~/lib/db";
import { sendTelegramMessage } from "~/lib/telegram";
import { sendEmail } from "~/lib/email";
import { rateLimit, getClientIp } from "~/lib/rate-limit";

function confirmationEmail(name: string): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#7c3aed;margin-bottom:16px;">Thanks for reaching out, ${name}</h2>
  <p>We received your message and our team will review it within 24 hours. You'll hear from us at this email address.</p>
  <p style="margin-top:24px;font-size:14px;color:#6b7280;">— MetroReach Media</p>
</body>
</html>`.trim();
}

function notificationEmail(payload: Record<string, string>): string {
  const { name, company, industry, email, message: msg, budget } = payload;
  const rows: string[] = [];
  rows.push(`<tr><td style="font-weight:600;padding:4px 12px 4px 0;white-space:nowrap">Name</td><td>${escapeHtml(name)}</td></tr>`);
  rows.push(`<tr><td style="font-weight:600;padding:4px 12px 4px 0;white-space:nowrap">Business</td><td>${escapeHtml(company)}</td></tr>`);
  rows.push(`<tr><td style="font-weight:600;padding:4px 12px 4px 0;white-space:nowrap">Industry</td><td>${escapeHtml(industry)}</td></tr>`);
  rows.push(`<tr><td style="font-weight:600;padding:4px 12px 4px 0;white-space:nowrap">Email</td><td>${escapeHtml(email)}</td></tr>`);
  if (budget) {
    rows.push(`<tr><td style="font-weight:600;padding:4px 12px 4px 0;white-space:nowrap">Budget</td><td>${escapeHtml(budget)}</td></tr>`);
  }

  return `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#7c3aed;margin-bottom:8px;">🚀 New Lead — MetroReach Media</h2>
  <table style="border-collapse:collapse;margin:16px 0;">
    ${rows.join("\n    ")}
  </table>
  <div style="background:#f5f3ff;padding:16px;border-radius:8px;margin:16px 0;">
    <p style="font-weight:600;margin:0 0 8px;">Message:</p>
    <p style="margin:0;">${escapeHtml(msg)}</p>
  </div>
  <p style="font-size:14px;color:#6b7280;">Source: homepage-form &middot; ${new Date().toISOString()}</p>
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

export const Route = createFileRoute("/api/contact")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ── Rate limiting ──
        const ip = getClientIp(request);
        const rl = rateLimit(`contact:${ip}`, 3, 60_000); // max 3 per minute
        if (!rl.allowed) {
          return new Response(
            JSON.stringify({ error: "Too many requests. Please wait a moment before trying again." }),
            { status: 429, headers: { "Content-Type": "application/json" } }
          );
        }

        let body: Record<string, string>;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, { status: 400 });
        }

        const { name, email, company, industry, message } = body;
        if (!name || !email || !company || !industry || !message) {
          return json({ error: "Missing required fields" }, { status: 400 });
        }

        const id = `contact-${randomBytes(8).toString("hex")}`;

        // ── Insert into Postgres ──
        try {
          await sql`
            INSERT INTO contact_leads (id, name, email, company, phone, industry, message, source)
            VALUES (${id}, ${name}, ${email}, ${company}, ${body.phone || ""}, ${industry}, ${message}, ${"homepage-form"})
          `;
        } catch (err: any) {
          console.error("contact_leads insert error:", err.message);
          // Non-fatal — continue with notifications even if DB insert fails
        }

        // Send Telegram notification (non-blocking)
        const tgLines: string[] = [];
        tgLines.push("🚀 <b>New Lead — MetroReach Media</b>");
        tgLines.push("");
        tgLines.push(`Name: ${name}`);
        tgLines.push(`Business: ${company}`);
        tgLines.push(`Industry: ${industry}`);
        tgLines.push(`Email: ${email}`);
        tgLines.push(`Budget: ${body.budget || "Not specified"}`);
        tgLines.push("");
        tgLines.push(`<b>Message:</b> ${message}`);
        tgLines.push("");
        tgLines.push(`<a href="https://7d5924e3a6715d74efa480bc8bb2da91.ctonew.app/leads">View all leads →</a>`);
        sendTelegramMessage(tgLines.join("\n")).catch(() => {
          // Silently ignore Telegram failures
        });

        // Send confirmation email to the lead (non-blocking)
        sendEmail({
          to: email,
          from: "bryce@metroreachagency.com",
          subject: "We got your message — MetroReach Media",
          body: confirmationEmail(name),
        }).catch(() => {
          // Silently ignore email failures so the form still succeeds
        });

        // Send notification email to Bryce (non-blocking)
        sendEmail({
          to: "bryce@metroreachagency.com",
          from: "support@metroreachagency.com",
          subject: `New Lead: ${name} from ${company}`,
          body: notificationEmail(body),
          replyTo: email,
        }).catch(() => {
          // Silently ignore email failures so the form still succeeds
        });

        return json({ success: true });
      },
    },
  },
});
