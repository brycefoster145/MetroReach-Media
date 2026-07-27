/**
 * Attribution Utility — src/lib/attribution.ts
 * MetroReach Media
 *
 * Phase 2: Conversion Events & Attribution Linking.
 *
 * resolveAttribution() — reads the __utm cookie from the incoming request,
 * resolves it against the scheduled_posts + clients tables, and returns a
 * typed AttributionData object. Uses last-touch attribution (most recent
 * UTM-tagged visit).
 *
 * writeConversionEvent() — inserts a row into the conversion_events table
 * with full attribution data.
 */

import { sql } from "~/lib/db";
import { getUtmCookie } from "~/lib/utm-store";
import type { UTMData } from "~/lib/utm-store";

// ══════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════

export interface AttributionData {
  source_type: "post" | "ad" | "profile" | "direct";
  source_platform?: string;
  source_post_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  client_id?: string;
}

// ══════════════════════════════════════════════════════════════════
// resolveAttribution
// ══════════════════════════════════════════════════════════════════

/**
 * Resolve attribution data from the incoming request.
 *
 * Reads the __utm cookie (set by our client-side capture script or the
 * /go/:clientSlug/:postId redirect handler). If the cookie contains a
 * utm_content value that looks like a post ID, we look up the post in
 * scheduled_posts to confirm the source_platform and source_post_id.
 *
 * Falls back to source_type='direct' when no UTM cookie is present.
 */
export async function resolveAttribution(
  request: Request,
): Promise<AttributionData> {
  const utm: UTMData | null = getUtmCookie(request);

  // No UTM cookie at all → direct traffic
  if (!utm) {
    return { source_type: "direct" };
  }

  const result: AttributionData = {
    source_type: "direct",
    utm_source: utm.utm_source,
    utm_medium: utm.utm_medium,
    utm_campaign: utm.utm_campaign,
    utm_content: utm.utm_content,
    utm_term: utm.utm_term,
  };

  // ── Resolve client from utm_campaign (which is the client slug) ──
  if (utm.utm_campaign) {
    try {
      const clientRows = await sql`
        SELECT id FROM clients
        WHERE service_slug = ${utm.utm_campaign}
           OR id = ${utm.utm_campaign}
        LIMIT 1
      `;
      if (clientRows.length > 0) {
        result.client_id = clientRows[0].id as string;
      }
    } catch {
      // Client lookup failed — continue without client_id
    }
  }

  // ── Determine source_type and resolve post attribution ──
  const postId = utm.utm_content;

  // If utm_content looks like a post ID, look up the post
  if (postId && postId.startsWith("post-")) {
    try {
      // We need to find the post. Try by id directly if we have a client_id,
      // otherwise search broadly
      let postRows: any[];
      if (result.client_id) {
        postRows = await sql`
          SELECT id, client_id, platform FROM scheduled_posts
          WHERE id = ${postId} AND client_id = ${result.client_id}
          LIMIT 1
        `;
      } else {
        postRows = await sql`
          SELECT id, client_id, platform FROM scheduled_posts
          WHERE id = ${postId}
          LIMIT 1
        `;
      }

      if (postRows.length > 0) {
        const post = postRows[0];
        result.source_type = "post";
        result.source_post_id = post.id as string;
        result.source_platform = post.platform as string;
        // If we didn't have a client_id yet, use the post's
        if (!result.client_id) {
          result.client_id = post.client_id as string;
        }
      } else {
        // Post ID in cookie but not found in DB — could be from a
        // different source. If utm_source looks like a platform, mark
        // as profile traffic
        if (utm.utm_source) {
          const knownPlatforms = ["facebook", "instagram", "x", "linkedin", "tiktok", "google"];
          if (knownPlatforms.includes(utm.utm_source.toLowerCase())) {
            result.source_type = "profile";
            result.source_platform = utm.utm_source.toLowerCase();
          }
        }
      }
    } catch {
      // Post lookup failed — fall through to source detection below
    }
  } else if (utm.utm_source) {
    // Has UTM source but no post ID — likely profile/direct traffic
    const knownPlatforms = ["facebook", "instagram", "x", "linkedin", "tiktok", "google"];
    if (knownPlatforms.includes(utm.utm_source.toLowerCase())) {
      result.source_type = "profile";
      result.source_platform = utm.utm_source.toLowerCase();
    }
  }

  // If we detected a post but utm_source differs from the post's platform,
  // prefer the post's platform (it's the authoritative source)
  if (
    result.source_type === "post" &&
    utm.utm_source &&
    result.source_platform &&
    utm.utm_source.toLowerCase() !== result.source_platform
  ) {
    // Keep the post's platform — it's more reliable
  }

  return result;
}

// ══════════════════════════════════════════════════════════════════
// writeConversionEvent
// ══════════════════════════════════════════════════════════════════

/**
 * Write a conversion event to the conversion_events table.
 *
 * Only writes if a client_id is present in the attribution data
 * (we don't log unattributed conversions).
 *
 * @param attribution - Resolved attribution data from resolveAttribution()
 * @param conversionType - Type of conversion ('purchase', 'onboarding_complete', 'lead_submitted', etc.)
 * @param conversionValueCents - Optional monetary value in cents
 * @param leadName - Optional lead name
 * @param leadEmail - Optional lead email
 * @param leadPhone - Optional lead phone
 * @param notes - Optional freeform notes
 */
export async function writeConversionEvent(
  attribution: AttributionData,
  conversionType: string,
  conversionValueCents?: number,
  leadName?: string,
  leadEmail?: string,
  leadPhone?: string,
  notes?: string,
): Promise<void> {
  // Only write if we have a client to attribute to
  if (!attribution.client_id) {
    console.log(
      "[attribution] Skipping conversion event — no client_id in attribution",
      { conversionType },
    );
    return;
  }

  try {
    await sql`
      INSERT INTO conversion_events (
        client_id,
        source_type,
        source_platform,
        source_post_id,
        lead_name,
        lead_email,
        lead_phone,
        conversion_type,
        conversion_value_cents,
        notes
      ) VALUES (
        ${attribution.client_id},
        ${attribution.source_type},
        ${attribution.source_platform || null},
        ${attribution.source_post_id || null},
        ${leadName || null},
        ${leadEmail || null},
        ${leadPhone || null},
        ${conversionType},
        ${conversionValueCents ?? null},
        ${notes || null}
      )
    `;
    console.log("[attribution] Conversion event written", {
      client_id: attribution.client_id,
      conversion_type: conversionType,
      source_type: attribution.source_type,
    });
  } catch (err: any) {
    console.error("[attribution] Failed to write conversion event:", err.message);
    // Non-fatal — don't throw, just log
  }
}
