/**
 * Buffer Channel Tracker — MetroReach Digital
 *
 * Tracks which Buffer channels ($12/channel) are allocated to which clients.
 * Prevents duplicate channel purchases when multiple clients share the same
 * platform. On client cancellation, marks channels as inactive.
 *
 * Server-only — import only from server-side code.
 */

import { sql } from "~/lib/db";

// ── Types ──

export interface BufferChannel {
  id: number;
  client_id: string;
  platform: string;
  platform_url: string;
  buffer_channel_id: string | null;
  is_active: boolean;
  cost_per_channel: number;
  created_at: string;
  updated_at: string;
}

/** Known platforms that map to Buffer channels */
const KNOWN_PLATFORMS = [
  "facebook",
  "instagram",
  "tiktok",
  "google",
  "youtube",
  "linkedin",
  "x",
  "twitter",
] as const;

const PLATFORM_ALIASES: Record<string, string> = {
  twitter: "x",
};

function normalizePlatform(platform: string): string {
  const key = platform.toLowerCase().trim();
  return PLATFORM_ALIASES[key] || key;
}

// ── Channel calculation ──

/**
 * Given a map of platform → URL (from client onboarding), return the number
 * of unique Buffer channels needed. Each distinct platform = 1 channel.
 * Cost is $12/channel.
 */
export function calculateChannels(
  platformUrls: Record<string, string>,
): { count: number; platforms: string[]; cost: number } {
  const platforms = new Set<string>();
  for (const key of Object.keys(platformUrls)) {
    const normalized = normalizePlatform(key);
    if (KNOWN_PLATFORMS.includes(normalized as any)) {
      platforms.add(normalized);
    }
  }
  const arr = Array.from(platforms);
  return {
    count: arr.length,
    platforms: arr,
    cost: arr.length * 12, // $12 per channel
  };
}

// ── Channel lifecycle ──

/**
 * Assign Buffer channels to a client based on their platform URLs.
 * Skips platforms that are already assigned (active) to this client.
 * If a platform URL changed, updates it.
 *
 * Call this when a client completes the onboarding form with platform URLs.
 */
export async function assignChannelsToClient(
  clientId: string,
  platformUrls: Record<string, string>,
): Promise<{ created: number; skipped: number; totalCost: number }> {
  const { platforms, cost } = calculateChannels(platformUrls);
  let created = 0;
  let skipped = 0;

  for (const platform of platforms) {
    const url = platformUrls[platform] || "";

    // Check if this client already has an active channel for this platform
    const existing = await sql<{ id: number }[]>`
      SELECT id FROM buffer_channels
      WHERE client_id = ${clientId}
        AND platform = ${platform}
        AND is_active = true
      LIMIT 1
    `;

    if (existing.length > 0) {
      // Update URL if changed
      await sql`
        UPDATE buffer_channels
        SET platform_url = ${url}, updated_at = NOW()
        WHERE id = ${existing[0].id}
      `;
      skipped++;
    } else {
      // Create new channel assignment
      await sql`
        INSERT INTO buffer_channels (
          client_id, platform, platform_url, is_active,
          cost_per_channel, created_at, updated_at
        ) VALUES (
          ${clientId}, ${platform}, ${url}, true,
          12, NOW(), NOW()
        )
      `;
      created++;
    }
  }

  return { created, skipped, totalCost: cost };
}

/**
 * Mark all Buffer channels for a client as inactive.
 * Call when a client cancels their service.
 */
export async function deactivateClientChannels(
  clientId: string,
): Promise<number> {
  const result = await sql<{ id: number }[]>`
    UPDATE buffer_channels
    SET is_active = false, updated_at = NOW()
    WHERE client_id = ${clientId}
      AND is_active = true
    RETURNING id
  `;
  return result.length;
}

/**
 * Reactivate channels for a client who resumes service.
 */
export async function reactivateClientChannels(
  clientId: string,
): Promise<number> {
  const result = await sql<{ id: number }[]>`
    UPDATE buffer_channels
    SET is_active = true, updated_at = NOW()
    WHERE client_id = ${clientId}
      AND is_active = false
    RETURNING id
  `;
  return result.length;
}

// ── Duplicate prevention ──

/**
 * Check if a platform is already covered by any active client.
 * Returns the list of client IDs who have active channels for each platform.
 * Used to detect shared-platform opportunities (no duplicate Buffer spend).
 */
export async function getActiveChannelsForPlatforms(
  platforms: string[],
): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};
  for (const platform of platforms) {
    const rows = await sql<{ client_id: string }[]>`
      SELECT DISTINCT client_id FROM buffer_channels
      WHERE platform = ${platform}
        AND is_active = true
    `;
    result[platform] = rows.map((r) => r.client_id);
  }
  return result;
}

/**
 * Get a summary of all Buffer channels and their costs per client.
 */
export async function getBufferChannelSummary(): Promise<
  { clientId: string; platformCount: number; monthlyCost: number }[]
> {
  const rows = await sql<
    { client_id: string; platform_count: number; monthly_cost: number }[]
  >`
    SELECT
      client_id,
      COUNT(*)::int AS platform_count,
      (COUNT(*) * 12)::int AS monthly_cost
    FROM buffer_channels
    WHERE is_active = true
    GROUP BY client_id
    ORDER BY monthly_cost DESC
  `;
  return rows.map((r) => ({
    clientId: r.client_id,
    platformCount: r.platform_count,
    monthlyCost: r.monthly_cost,
  }));
}

/**
 * Get all channels for a specific client.
 */
export async function getClientChannels(
  clientId: string,
): Promise<BufferChannel[]> {
  return sql<BufferChannel[]>`
    SELECT * FROM buffer_channels
    WHERE client_id = ${clientId}
    ORDER BY platform
  `;
}
