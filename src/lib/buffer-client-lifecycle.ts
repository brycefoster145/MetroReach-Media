import { sql } from "~/lib/db";
import { sendEmail } from "~/lib/email";
import { sendTelegramMessage } from "~/lib/telegram";

export type ClientChannelStatus = "pending_manual" | "active" | "cancelled" | "agency_reference";
export interface ClientChannelRecord {
  id: string;
  stripe_customer_id: string | null;
  customer_email: string | null;
  buffer_channel_id: string | null;
  platform: string;
  created_at: string;
  status: ClientChannelStatus;
}

const TIER_PLATFORM_COUNTS: Record<string, number> = {
  starter: 2,
  growth: 4,
  scale: 7,
  "vip-daily": 7,
  vip_daily: 7,
};
const SUPPORTED = new Set(["instagram", "facebook"]);
const AGENCY_CHANNELS = new Set(["6a6156cee2638b94d7b9abf0", "6a615653e2638b94d7b9aa6f"]);

function normalisePlatform(value: string): string {
  return value.trim().toLowerCase().replace(/[ _-]+/g, "_");
}
function displayPlatform(value: string): string {
  return value === "instagram" ? "Instagram" : value === "facebook" ? "Facebook" : value;
}


/**
 * Buffer's public GraphQL API can publish/delete posts, but does not expose a
 * server-side channel creation or disconnect mutation. Channel OAuth consent
 * must therefore be completed manually by an administrator. This function
 * records a durable provisioning request rather than pretending a channel was
 * created.
 */
export async function requestBufferChannels(params: {
  stripeCustomerId: string | null;
  email: string;
  packageSlug: string;
  preferredPlatforms?: string[];
}): Promise<{ requested: string[]; unsupported: string[] }> {
  const count = TIER_PLATFORM_COUNTS[params.packageSlug.toLowerCase()];
  if (!count) return { requested: [], unsupported: [] };

  const preferred = (params.preferredPlatforms ?? []).map(normalisePlatform).filter(Boolean);
  // Without an explicit preference, only request the platforms Buffer can be
  // connected to after manual OAuth. Never invent the remaining package slots.
  const platforms = (preferred.length ? preferred : ["instagram", "facebook"]).slice(0, count);
  const requested = platforms.filter((p) => SUPPORTED.has(p));
  const unsupported = platforms.filter((p) => !SUPPORTED.has(p));
  if (unsupported.length) {
    console.warn(`[buffer] Skipping unsupported/LLC-gated platforms for ${params.email}: ${unsupported.join(", ")}`);
  }

  for (const platform of requested) {
    await sql`
      INSERT INTO client_channels
        (stripe_customer_id, customer_email, buffer_channel_id, platform, status)
      SELECT ${params.stripeCustomerId}, ${params.email}, NULL, ${platform}, 'pending_manual'
      WHERE NOT EXISTS (
        SELECT 1 FROM client_channels
        WHERE stripe_customer_id IS NOT DISTINCT FROM ${params.stripeCustomerId}
          AND LOWER(customer_email) = LOWER(${params.email})
          AND platform = ${platform}
          AND status <> 'cancelled'
      )
    `;
  }

  const adminEmail = process.env.BUFFER_CHANNEL_ADMIN_EMAIL || "support@metroreachagency.com";
  if (requested.length) {
    const [result] = await Promise.all([
      sendEmail({
        to: adminEmail,
        from: "support@metroreachagency.com",
        subject: `Buffer channel setup required — ${params.email}`,
        body: `<p>Manual Buffer OAuth setup is required for <strong>${params.email}</strong>.</p><p>Package: ${params.packageSlug}; requested: ${requested.map(displayPlatform).join(", ")}.</p><p>Buffer does not expose programmatic channel creation/disconnection. After connecting each channel, link its real channel ID through the protected client-channels admin endpoint.</p>`,
      }),
      sendTelegramMessage([
        "<b>Manual Buffer channel setup required</b>",
        `Customer: ${params.email}`,
        `Package: ${params.packageSlug}`,
        `Requested platforms: ${requested.map(displayPlatform).join(", ")}`,
      ].join("\n")),
    ]);
    if (!result.success) console.error("[buffer] Admin setup notification failed:", result.error);
  }
  return { requested, unsupported };
}

export async function cancelBufferChannels(stripeCustomerId: string): Promise<void> {
  const rows = await sql`
    SELECT buffer_channel_id, platform FROM client_channels
    WHERE stripe_customer_id = ${stripeCustomerId} AND status <> 'cancelled'
  ` as unknown as Array<{ buffer_channel_id: string | null; platform: string }>;
  for (const row of rows) {
    if (row.buffer_channel_id && !AGENCY_CHANNELS.has(row.buffer_channel_id)) {
      // Buffer has no public disconnect mutation. Do not call deletePost: a
      // channel ID is not a post ID and deleting posts would be destructive.
      console.warn(`[buffer] Channel ${row.buffer_channel_id} requires manual disconnect; marking cancelled`);
    }
  }
  await sql`
    UPDATE client_channels SET status = 'cancelled'
    WHERE stripe_customer_id = ${stripeCustomerId} AND status <> 'cancelled'
  `;
}

export { AGENCY_CHANNELS };
