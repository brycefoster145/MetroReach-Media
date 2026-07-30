/**
 * GET /api/portal/linkedin-oauth-callback
 *
 * Handles the LinkedIn OAuth redirect after a client authorizes our app.
 * Exchanges the authorization code for an access token, fetches the
 * user's company pages via organizationAcls, and stores tokens in
 * client_platform_tokens.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { getClientFromRequest } from "~/lib/client-auth";
import { sql } from "~/lib/db";
import {
  exchangeCodeForToken,
  getUserOrganizations,
  buildLinkedInAuthUrl,
} from "~/lib/linkedin-oauth-helpers";

const REDIRECT_URI = "https://metroreachagency.com/api/portal/linkedin-oauth-callback";
const SCOPES = "w_member_social r_organization_social w_organization_social";

/**
 * Construct the OAuth authorization URL for the portal flow.
 */
export function getLinkedInAuthUrl(state: string): string {
  return buildLinkedInAuthUrl(SCOPES, REDIRECT_URI, state);
}

export const Route = createFileRoute("/api/portal/linkedin-oauth-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");

        // Get the authenticated client
        const client = getClientFromRequest(request);

        // If user denied or an error occurred, redirect back with error
        if (error || !code) {
          const redirectUrl = new URL("https://metroreachagency.com/portal/connect");
          redirectUrl.searchParams.set("oauth_result", "error");
          redirectUrl.searchParams.set(
            "error_msg",
            errorDescription || error || "Authorization was cancelled or failed."
          );
          return new Response(null, {
            status: 302,
            headers: { Location: redirectUrl.toString() },
          });
        }

        if (!client) {
          const redirectUrl = new URL("https://metroreachagency.com/portal/connect");
          redirectUrl.searchParams.set("oauth_result", "error");
          redirectUrl.searchParams.set(
            "error_msg",
            "Your portal session expired. Please log in first, then reconnect."
          );
          return new Response(null, {
            status: 302,
            headers: { Location: redirectUrl.toString() },
          });
        }

        try {
          // Step 1: Exchange code for access token
          const tokenData = await exchangeCodeForToken(code, REDIRECT_URI);

          // Step 2: Get user's organizations
          const orgs = await getUserOrganizations(tokenData.access_token);

          if (orgs.length === 0) {
            const redirectUrl = new URL("https://metroreachagency.com/portal/connect");
            redirectUrl.searchParams.set("oauth_result", "error");
            redirectUrl.searchParams.set(
              "error_msg",
              "No LinkedIn Company Pages found on your account. You need to be an admin of a LinkedIn Company Page to connect."
            );
            return new Response(null, {
              status: 302,
              headers: { Location: redirectUrl.toString() },
            });
          }

          // Step 3: Store each organization token in client_platform_tokens
          const expiresAt = tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000)
            : null;

          for (const org of orgs) {
            // Insert if not exists
            await sql`
              INSERT INTO client_platform_tokens (client_id, platform, access_token, page_id, account_name, expires_at)
              VALUES (${client.sub}, 'linkedin', ${tokenData.access_token}, ${org.organization_id}, ${org.organization_name}, ${
                expiresAt?.toISOString() ?? null
              })
              ON CONFLICT DO NOTHING
            `.catch(() => {});

            // Update if already exists
            await sql`
              UPDATE client_platform_tokens
              SET access_token = ${tokenData.access_token},
                  account_name = ${org.organization_name},
                  expires_at = ${expiresAt?.toISOString() ?? null}
              WHERE client_id = ${client.sub}
                AND platform = 'linkedin'
                AND page_id = ${org.organization_id}
            `;
          }

          // Redirect back to connect page with success
          const redirectUrl = new URL("https://metroreachagency.com/portal/connect");
          redirectUrl.searchParams.set("oauth_result", "success");
          return new Response(null, {
            status: 302,
            headers: { Location: redirectUrl.toString() },
          });
        } catch (err: any) {
          console.error("LinkedIn OAuth callback error:", err.message);
          const redirectUrl = new URL("https://metroreachagency.com/portal/connect");
          redirectUrl.searchParams.set("oauth_result", "error");
          redirectUrl.searchParams.set("error_msg", encodeURIComponent(err.message));
          return new Response(null, {
            status: 302,
            headers: { Location: redirectUrl.toString() },
          });
        }
      },
    },
  },
});
