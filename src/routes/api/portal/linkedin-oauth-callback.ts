/**
 * GET /api/portal/linkedin-oauth-callback
 *
 * Handles the LinkedIn OAuth redirect after a client authorizes our app.
 * Exchanges the authorization code for an access token, fetches the
 * user's company pages via organizationAcls, and stores tokens in
 * client_platform_tokens.
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { getClientFromRequest } from "~/lib/client-auth";
import { sql } from "~/lib/db";

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || "";
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || "";
const REDIRECT_URI = "https://metroreachagency.com/api/portal/linkedin-oauth-callback";
const LINKEDIN_API_BASE = "https://api.linkedin.com";
const LINKEDIN_VERSION = "202501";

/**
 * Exchange authorization code for an access token.
 */
async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  expires_in: number;
  scope: string;
}> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: LINKEDIN_CLIENT_ID,
    client_secret: LINKEDIN_CLIENT_SECRET,
  });

  const res = await fetch(`${LINKEDIN_API_BASE}/oauth/v2/accessToken`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const json = await res.json();
  if (json.error) {
    throw new Error(
      `LinkedIn token exchange failed: ${json.error_description || json.error}`
    );
  }
  return json as { access_token: string; expires_in: number; scope: string };
}

/**
 * Fetch organizations (company pages) the authenticated user administers.
 */
async function getUserOrganizations(accessToken: string): Promise<
  Array<{ organization_id: string; organization_name: string }>
> {
  const url = new URL(
    `${LINKEDIN_API_BASE}/v2/organizationAcls`
  );
  url.searchParams.set("q", "roleAssignee");
  url.searchParams.set("role", "ADMINISTRATOR");
  url.searchParams.set("state", "APPROVED");
  url.searchParams.set("projection", "(elements*(*,organization~(id,localizedName)))");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": LINKEDIN_VERSION,
    },
  });

  const json = await res.json();
  if (json.error || json.status >= 400) {
    const errMsg =
      typeof json.message === "string"
        ? json.message
        : json.error_description || json.error || "Unknown error";
    throw new Error(`Failed to fetch LinkedIn organizations: ${errMsg}`);
  }

  const elements: any[] = json.elements ?? [];
  return elements.map((el: any) => {
    const org = el["organization~"] ?? el.organization ?? {};
    const id = org?.id ?? el.organization;
    // Extract the numeric part from the URN if needed
    const idStr = typeof id === "string" ? id : String(id ?? "");
    const name =
      org?.localizedName ??
      org?.name ??
      idStr.split(":").pop() ??
      "LinkedIn Company Page";
    return {
      organization_id: idStr,
      organization_name: typeof name === "string" ? name : String(name),
    };
  });
}

/**
 * Construct the OAuth authorization URL.
 */
export function getLinkedInAuthUrl(state: string): string {
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", LINKEDIN_CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", "w_member_social r_organization_social");
  url.searchParams.set("state", state);
  return url.toString();
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
          const tokenData = await exchangeCodeForToken(code);

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
