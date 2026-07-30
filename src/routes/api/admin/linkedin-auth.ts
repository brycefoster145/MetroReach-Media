/**
 * GET /api/admin/linkedin-auth
 *
 * Admin-only endpoint for authorizing LinkedIn with organization-scoped permissions.
 * Handles both the OAuth initiation (redirect to LinkedIn) and callback
 * (exchange code, find MetroReach Media company page, store token).
 *
 * The owner visits: https://metroreachagency.com/api/admin/linkedin-auth
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";
import {
  exchangeCodeForToken,
  getUserOrganizations,
  buildLinkedInAuthUrl,
} from "~/lib/linkedin-oauth-helpers";

const REDIRECT_URI = "https://metroreachagency.com/api/admin/linkedin-auth";
const SCOPES = "r_organization_social w_organization_social";
const METROREACH_ORG_ID = "136664371";
const METROREACH_ORG_NAME = "MetroReach Media";

export const Route = createFileRoute("/api/admin/linkedin-auth")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");

        // ── Callback phase: LinkedIn redirected back with a code ──
        if (code) {
          // Handle user denial
          if (error) {
            return new Response(
              `<h1>LinkedIn Auth Failed</h1><p>${errorDescription || error}</p>`,
              { status: 400, headers: { "Content-Type": "text/html" } }
            );
          }

          try {
            // Step 1: Exchange code for access token
            const tokenData = await exchangeCodeForToken(code, REDIRECT_URI);

            // Step 2: Get user's organizations
            const orgs = await getUserOrganizations(tokenData.access_token);

            if (orgs.length === 0) {
              return new Response(
                `<h1>No Company Pages Found</h1>
<p>Your LinkedIn account does not administer any Company Pages. You must be an admin of the MetroReach Media Company Page to proceed.</p>
<p><a href="/api/admin/linkedin-auth">Try again</a></p>`,
                { status: 400, headers: { "Content-Type": "text/html" } }
              );
            }

            // Step 3: Find the MetroReach Media company page
            // The organization_id from the API may be a full URN like "urn:li:organization:136664371"
            // or just the numeric ID "136664371". Normalize to match.
            const metroreachOrg = orgs.find((org) => {
              const normalized = org.organization_id.replace("urn:li:organization:", "");
              return normalized === METROREACH_ORG_ID;
            });

            if (!metroreachOrg) {
              const orgList = orgs
                .map((o) => `${o.organization_name} (${o.organization_id})`)
                .join("<br>");
              return new Response(
                `<h1>MetroReach Media Not Found</h1>
<p>The MetroReach Media Company Page (ID: ${METROREACH_ORG_ID}) was not found among your administered pages.</p>
<p>Your administered pages:</p>
<ul>${orgs.map((o) => `<li>${o.organization_name} (${o.organization_id})</li>`).join("")}</ul>
<p><a href="/api/admin/linkedin-auth">Try again</a></p>`,
                { status: 400, headers: { "Content-Type": "text/html" } }
              );
            }

            // Step 4: Store the token in client_platform_tokens
            const expiresAt = tokenData.expires_in
              ? new Date(Date.now() + tokenData.expires_in * 1000)
              : null;

            // UPSERT: Insert if not exists, update if exists
            await sql`
              INSERT INTO client_platform_tokens (client_id, platform, access_token, page_id, account_name, expires_at)
              VALUES ('metroreach', 'linkedin', ${tokenData.access_token}, ${METROREACH_ORG_ID}, ${METROREACH_ORG_NAME}, ${
                expiresAt?.toISOString() ?? null
              })
              ON CONFLICT (client_id, platform, page_id) DO UPDATE
              SET access_token = EXCLUDED.access_token,
                  account_name = EXCLUDED.account_name,
                  expires_at = EXCLUDED.expires_at,
                  token_status = 'active'
            `;

            return new Response(
              `<h1>✅ LinkedIn Re-Authorized</h1>
<p>MetroReach Media Company Page connected.</p>
<p><strong>Page:</strong> ${metroreachOrg.organization_name} (${metroreachOrg.organization_id})</p>
<p><strong>Scopes granted:</strong> ${tokenData.scope}</p>
<p><strong>Expires:</strong> ${expiresAt ? expiresAt.toLocaleString() : "N/A"}</p>
<p><a href="/">Back to site</a></p>`,
              { status: 200, headers: { "Content-Type": "text/html" } }
            );
          } catch (err: any) {
            console.error("Admin LinkedIn OAuth callback error:", err.message);
            return new Response(
              `<h1>Error</h1><p>${err.message}</p><p><a href="/api/admin/linkedin-auth">Try again</a></p>`,
              { status: 500, headers: { "Content-Type": "text/html" } }
            );
          }
        }

        // ── Initiate phase: redirect owner to LinkedIn for authorization ──
        const authUrl = buildLinkedInAuthUrl(SCOPES, REDIRECT_URI);
        return new Response(null, {
          status: 302,
          headers: { Location: authUrl },
        });
      },
    },
  },
});
