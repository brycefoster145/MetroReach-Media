import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import fs from "node:fs";
import path from "node:path";
import { sendTelegramMessage } from "~/lib/telegram";

const LEADS_FILE = path.join(process.cwd(), "..", "leads.json");

export const Route = createFileRoute("/api/contact")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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

        const lead = {
          fullName: name,
          businessName: company,
          industry,
          email,
          phone: "",
          frustration: message,
          budget: "",
          source: "homepage-form",
          timestamp: new Date().toISOString(),
        };

        let leads: typeof lead[] = [];
        try {
          const raw = fs.readFileSync(LEADS_FILE, "utf-8");
          leads = JSON.parse(raw);
        } catch {
          // File doesn't exist yet — that's fine
        }

        leads.push(lead);
        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));

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

        return json({ success: true });
      },
    },
  },
});
