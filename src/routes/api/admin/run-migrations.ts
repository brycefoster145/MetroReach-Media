/**
 * POST /api/admin/run-migrations
 *
 * One-shot: runs the idempotent migration suite to create any missing
 * tables (including buffer_credentials). Auth-gated.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { migrate } from "~/lib/migrate";
import { requireApiKey } from "~/lib/env";

export const Route = createFileRoute("/api/admin/run-migrations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = requireApiKey(request);
        if (auth) return auth;

        try {
          await migrate();
          return new Response(JSON.stringify({ ok: true, message: "Migrations complete." }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ ok: false, error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
