const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TOKEN_URL = "https://login.microsoftonline.com";

const ALLOWED_FROM: ReadonlySet<string> = new Set([
  "bryce@metroreachagency.com",
  "ads@metroreachagency.com",
  "reports@metroreachagency.com",
  "support@metroreachagency.com",
]);

export { ALLOWED_FROM };

interface SendEmailParams {
  to: string;
  from: string;
  subject: string;
  body: string;
  replyTo?: string;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Return cached token if it still has 60+ seconds left
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const clientId = process.env.MS_CLIENT_ID;
  const tenantId = process.env.MS_TENANT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;

  if (!clientId || !tenantId || !clientSecret) {
    throw new Error(
      "Missing MS_CLIENT_ID, MS_TENANT_ID, or MS_CLIENT_SECRET environment variables",
    );
  }

  const params = new URLSearchParams();
  params.set("client_id", clientId);
  params.set("client_secret", clientSecret);
  params.set("grant_type", "client_credentials");
  params.set("scope", "https://graph.microsoft.com/.default");

  const res = await fetch(
    `${TOKEN_URL}/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft auth failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.value;
}

/**
 * Send an email through Microsoft 365 / Graph API using client credentials.
 *
 * `from` must be one of the agency's verified addresses:
 * bryce@, ads@, reports@, support@metroreachagency.com
 */
export async function sendEmail({
  to,
  from,
  subject,
  body,
  replyTo,
}: SendEmailParams): Promise<SendResult> {
  if (!to || !from || !subject || !body) {
    return { success: false, error: "Missing required fields: to, from, subject, body" };
  }

  if (!ALLOWED_FROM.has(from)) {
    return {
      success: false,
      error: `Invalid from address: ${from}. Must be one of: ${[...ALLOWED_FROM].join(", ")}`,
    };
  }

  try {
    const token = await getAccessToken();

    const payload: Record<string, unknown> = {
      message: {
        subject,
        body: {
          contentType: "HTML",
          content: body,
        },
        toRecipients: [
          {
            emailAddress: { address: to },
          },
        ],
      },
    };

    if (replyTo) {
      (payload.message as Record<string, unknown>).replyTo = [
        { emailAddress: { address: replyTo } },
      ];
    }

    const res = await fetch(`${GRAPH_BASE}/users/${from}/sendMail`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Graph API error (${res.status}): ${text}` };
    }

    // sendMail returns 202 Accepted with no body on success.
    // There's no messageId in the response for sendMail, but we can note it was accepted.
    return { success: true, messageId: `accepted-${Date.now()}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
