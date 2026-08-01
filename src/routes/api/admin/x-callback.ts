import { createFileRoute } from "@tanstack/react-router";
import { requireApiKey } from "~/lib/env";
import { sql } from "~/lib/db";

const X_CLIENT_ID = process.env.X_CLIENT_ID || "";
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET || "";
const REDIRECT_URI = "https://metroreachagency.com/api/admin/x-callback";

export const Route = createFileRoute("/api/admin/x-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const unauthorized = requireApiKey(request);
        if (unauthorized) return unauthorized;
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error || !code) {
          return new Response(`<h1>X Auth Failed</h1><p>${error || "No code"}</p>`, {
            status: 400,
            headers: { "Content-Type": "text/html" },
          });
        }

        const cookies = request.headers.get("cookie") ?? "";
        const match = cookies.match(/(?:^|;\s*)admin_x_verifier=([^;]*)/);
        const codeVerifier = match ? decodeURIComponent(match[1]) : "";

        if (!codeVerifier) {
          return new Response("<h1>Session expired</h1><p>Try again</p>", {
            status: 400,
            headers: { "Content-Type": "text/html" },
          });
        }

        try {
          const params = new URLSearchParams({
            code,
            grant_type: "authorization_code",
            redirect_uri: REDIRECT_URI,
            code_verifier: codeVerifier,
          });

          const basicAuth = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString("base64");

          const tokenRes = await fetch("https://api.x.com/2/oauth2/token", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Basic ${basicAuth}`,
            },
            body: params.toString(),
          });

          const tokenData = await tokenRes.json();
          if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

          const userRes = await fetch("https://api.x.com/2/users/me", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          const userData = await userRes.json();
          const user = userData.data ?? userData;

          await sql`
            INSERT INTO client_platform_tokens (client_id, platform, access_token, page_id, account_name, expires_at)
            VALUES ('metroreach', 'x', ${tokenData.access_token}, ${user.id}, ${`${user.name} (@${user.username})`}, ${new Date(Date.now() + (tokenData.expires_in || 7200) * 1000).toISOString()})
            ON CONFLICT (client_id, platform, page_id) DO UPDATE SET access_token = EXCLUDED.access_token, account_name = EXCLUDED.account_name, expires_at = EXCLUDED.expires_at
          `;

          return new Response(
            `<h1>✅ X Connected!</h1><p>${user.name} (@${user.username}) — your X account is now connected to MetroReach Media.</p><p><a href="/">Back to site</a></p>`,
            { status: 200, headers: { "Content-Type": "text/html" } },
          );
        } catch (err: any) {
          return new Response(`<h1>Error</h1><p>${err.message}</p>`, {
            status: 500,
            headers: { "Content-Type": "text/html" },
          });
        }
      },
    },
  },
});
