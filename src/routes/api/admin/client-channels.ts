import { createFileRoute } from "@tanstack/react-router";
import { requireApiKey } from "~/lib/env";
import { sql } from "~/lib/db";
import { AGENCY_CHANNELS } from "~/lib/buffer-client-lifecycle";

export const Route = createFileRoute("/api/admin/client-channels")({
  server: { handlers: {
    GET: async ({ request }) => {
      const unauthorized = requireApiKey(request);
      if (unauthorized) return unauthorized;
      const customerId = new URL(request.url).searchParams.get("stripe_customer_id");
      const rows = await sql`
        SELECT id, stripe_customer_id, customer_email, buffer_channel_id, platform, created_at, status
        FROM client_channels
        WHERE (${customerId} IS NULL OR stripe_customer_id = ${customerId})
        ORDER BY created_at DESC
      `;
      return Response.json(rows);
    },
    POST: async ({ request }) => {
      const unauthorized = requireApiKey(request);
      if (unauthorized) return unauthorized;
      try {
        const body = await request.json() as { id?: string; buffer_channel_id?: string };
        if (!body.id || !body.buffer_channel_id || AGENCY_CHANNELS.has(body.buffer_channel_id)) {
          return Response.json({ error: "A real client channel id is required; agency channels are forbidden" }, { status: 400 });
        }
        const rows = await sql`
          UPDATE client_channels SET buffer_channel_id = ${body.buffer_channel_id}, status = 'active'
          WHERE id = ${body.id} AND status = 'pending_manual'
          RETURNING id, buffer_channel_id, platform, status
        `;
        if (!rows.length) return Response.json({ error: "Pending channel request not found" }, { status: 404 });
        return Response.json(rows[0]);
      } catch (error) {
        console.error("[client-channels] link failed", error);
        return Response.json({ error: "Invalid request" }, { status: 400 });
      }
    },
  }},
});
