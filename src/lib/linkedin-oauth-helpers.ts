/**
 * LinkedIn OAuth helpers — shared between portal and admin OAuth flows.
 * MetroReach Media — Premium Social Media Marketing Agency
 */

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || "";
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || "";
const LINKEDIN_API_BASE = "https://api.linkedin.com";
const LINKEDIN_VERSION = "202501";

/**
 * Exchange an authorization code for an access token.
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<{
  access_token: string;
  expires_in: number;
  scope: string;
}> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
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
export async function getUserOrganizations(
  accessToken: string
): Promise<
  Array<{ organization_id: string; organization_name: string }>
> {
  const url = new URL(`${LINKEDIN_API_BASE}/v2/organizationAcls`);
  url.searchParams.set("q", "roleAssignee");
  url.searchParams.set("role", "ADMINISTRATOR");
  url.searchParams.set("state", "APPROVED");
  url.searchParams.set(
    "projection",
    "(elements*(*,organization~(id,localizedName)))"
  );

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
 * Build a LinkedIn OAuth authorization URL.
 */
export function buildLinkedInAuthUrl(
  scope: string,
  redirectUri: string,
  state?: string
): string {
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", LINKEDIN_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  if (state) {
    url.searchParams.set("state", state);
  }
  return url.toString();
}
