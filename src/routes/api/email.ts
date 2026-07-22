import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { sendEmail, ALLOWED_FROM } from "~/lib/email";

export const Route = createFileRoute("/api/email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // API key check
        const apiKey = process.env.MS_API_KEY;
        if (!apiKey) {
          return json(
            { error: "Server misconfigured: MS_API_KEY not set" },
            { status: 500 },
          );
        }

        const authHeader = request.headers.get("x-api-key");
        if (!authHeader || authHeader !== apiKey) {
          return json({ error: "Unauthorized" }, { status: 401 });
        }

        // Parse body
        let body: Record<string, string>;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, { status: 400 });
        }

        const { to, from, subject, body: emailBody, replyTo } = body;

        if (!to || !from || !subject || !emailBody) {
          return json(
            { error: "Missing required fields: to, from, subject, body" },
            { status: 400 },
          );
        }

        if (!ALLOWED_FROM.has(from)) {
          return json(
            {
              error: `Invalid from address. Allowed: ${[...ALLOWED_FROM].join(", ")}`,
            },
            { status: 400 },
          );
        }

        const result = await sendEmail({
          to,
          from,
          subject,
          body: emailBody,
          replyTo,
        });

        if (!result.success) {
          return json(
            { error: result.error || "Failed to send email" },
            { status: 502 },
          );
        }

        return json({ success: true, messageId: result.messageId });
      },
    },
  },
});
