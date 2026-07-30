/**
 * Meta (Facebook/Instagram) direct posting utility.
 *
 * Posts directly via the Facebook Graph API using the system user token.
 * Used by the posting scheduler to publish scheduled posts at exact times.
 *
 * No third-party middleware — direct Graph API v21.0 calls.
 */
const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

interface GraphApiError {
  error?: {
    message: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

async function graphApiRequest<T = unknown>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  params?: Record<string, string>,
  body?: Record<string, unknown>,
  accessToken?: string,
): Promise<T> {
  const token = accessToken ?? process.env.META_ACCESS_TOKEN ?? "";
  const url = new URL(`${GRAPH_API_BASE}${path}`);
  url.searchParams.set("access_token", token);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const fetchOpts: RequestInit = {
    method,
    headers: { Accept: "application/json" },
  };

  if ((method === "POST" || method === "DELETE") && body) {
    fetchOpts.headers = {
      ...(fetchOpts.headers as Record<string, string>),
      "Content-Type": "application/json",
    };
    fetchOpts.body = JSON.stringify(body);
  }

  const res = await fetch(url.toString(), fetchOpts);
  const json = await res.json();

  const errJson = json as GraphApiError;
  if (errJson.error) {
    throw new Error(
      `Meta API error: ${errJson.error.message} (code ${errJson.error.code})`,
    );
  }

  return json as T;
}

/**
 * Get a page access token for a specific Facebook Page.
 * Uses the system user token to fetch all pages via /me/accounts,
 * then filters by page ID to find the matching page access token.
 */
export async function getPageAccessToken(
  pageId: string,
): Promise<string> {
  const systemToken = process.env.META_ACCESS_TOKEN;
  if (!systemToken) {
    throw new Error("META_ACCESS_TOKEN is not set");
  }

  const data = await graphApiRequest<{
    data: Array<{ id: string; access_token: string; name: string }>;
  }>(
    "GET",
    "/me/accounts",
    { fields: "id,access_token,name" },
    undefined,
    systemToken,
  );

  const page = data.data.find((p) => p.id === pageId);
  if (!page) {
    throw new Error(`Page ${pageId} not found in user's accounts`);
  }

  return page.access_token;
}

export interface PostResult {
  post_id: string;
  platform: "facebook" | "instagram";
  status: string;
}

/**
 * Publish a post to a Facebook Page.
 */
export async function postToFacebook(
  pageId: string,
  text: string,
  mediaUrls?: string[],
): Promise<PostResult> {
  const pageToken = await getPageAccessToken(pageId);

  const postBody: Record<string, unknown> = { message: text };

  if (mediaUrls && mediaUrls.length > 0) {
    if (mediaUrls.length === 1) {
      postBody.link = mediaUrls[0];
    } else {
      const mediaIds: string[] = [];
      for (const url of mediaUrls) {
        const photo = await graphApiRequest<{ id: string }>(
          "POST",
          `/${pageId}/photos`,
          undefined,
          { url, published: false },
          pageToken,
        );
        mediaIds.push(photo.id);
      }
      postBody.attached_media = mediaIds.map((id) => ({ media_fbid: id }));
    }
  }

  const result = await graphApiRequest<{ id: string; post_id?: string }>(
    "POST",
    `/${pageId}/feed`,
    undefined,
    postBody,
    pageToken,
  );

  return {
    post_id: result.id || result.post_id || "",
    platform: "facebook",
    status: "published",
  };
}

/**
 * Error thrown when an Instagram post has no media_urls.
 * Caught by the cron scheduler to mark as skipped_no_media instead of failed.
 */
export class NoMediaError extends Error {
  constructor(postId: string) {
    super(`Instagram post ${postId} has no media_urls — cannot publish without an image`);
    this.name = "NoMediaError";
  }
}

/**
 * Publish a post to an Instagram Business Account.
 * Uses the two-step container creation → publish flow.
 *
 * REQUIRES at least one media_url. Instagram does not support text-only posts.
 * If mediaUrls is empty/undefined, throws NoMediaError — the cron catches this
 * and marks the post as skipped_no_media instead of attempting to publish.
 */
export async function postToInstagram(
  igUserId: string,
  text: string,
  mediaUrls?: string[],
): Promise<PostResult> {
  // ── PRE-FLIGHT: Instagram REQUIRES an image ──
  // Image generation happens at SCHEDULE time (in schedule-post API), not here.
  // If a post reaches this function without media_urls, it means image generation
  // failed or was skipped. We must NOT attempt to publish — Meta API will reject it.
  if (!mediaUrls || mediaUrls.length === 0) {
    throw new NoMediaError("unknown");
  }

  // Use system user token directly — page token from /me/accounts
  // may drop Instagram permissions even if the system token carries them.
  const pageToken = process.env.META_ACCESS_TOKEN!;

  // Step 1: Create media container
  const mediaBody: Record<string, unknown> = {
    caption: text,
    image_url: mediaUrls[0],
  };

  const container = await graphApiRequest<{ id: string }>(
    "POST",
    `/${igUserId}/media`,
    undefined,
    mediaBody,
    pageToken,
  );

  // Step 2: Wait for container to be ready before publishing
  // Meta needs time to process the image; publishing immediately yields error 9007
  let status = "IN_PROGRESS";
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const check = await graphApiRequest<{ status_code?: string; status?: string }>(
      "GET",
      `/${container.id}?fields=status_code,status`,
      undefined,
      undefined,
      pageToken,
    );
    status = check.status_code || check.status || "IN_PROGRESS";
    if (status === "FINISHED") break;
  }

  if (status !== "FINISHED") {
    throw new Error(`Media container not ready after 20s: ${status}`);
  }

  // Step 3: Publish the container
  const publishResult = await graphApiRequest<{ id: string }>(
    "POST",
    `/${igUserId}/media_publish`,
    undefined,
    { creation_id: container.id },
    pageToken,
  );

  // Step 4: Resolve the REAL IG Media ID.
  // The publish endpoint sometimes returns the container creation ID
  // instead of the actual IG Media ID. Container IDs cannot be used for
  // DELETE operations (Meta error 100: "Object does not exist").
  // We query the media list and match by caption to find the real,
  // delete-able media ID.
  const realMediaId = await resolveRealIgMediaId(
    igUserId,
    publishResult.id,
    text,
  );

  return {
    post_id: realMediaId,
    platform: "instagram",
    status: "published",
  };
}

/**
 * Main publish function — routes to the correct platform handler.
 */
export async function publishPost(params: {
  platform: "facebook" | "instagram";
  pageId: string;
  igUserId?: string;
  text: string;
  mediaUrls?: string[];
}): Promise<PostResult> {
  const { platform, pageId, igUserId, text, mediaUrls } = params;

  if (platform === "instagram") {
    if (!igUserId) {
      throw new Error("igUserId is required for Instagram posts");
    }
    return postToInstagram(igUserId, text, mediaUrls);
  }

  return postToFacebook(pageId, text, mediaUrls);
}

export interface InstagramMedia {
  id: string;
  caption?: string;
  media_url?: string;
  permalink?: string;
  timestamp?: string;
}

/**
 * List recent Instagram media for an IG Business Account.
 *
 * Calls GET /{ig-user-id}/media to retrieve published media objects.
 * Returns real IG Media IDs that can be used for DELETE operations.
 *
 * Reference: https://developers.facebook.com/docs/instagram-api/reference/ig-user/media
 */
export async function listInstagramMedia(
  igUserId: string,
  limit = 25,
): Promise<InstagramMedia[]> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    throw new Error("META_ACCESS_TOKEN is not set");
  }

  console.log(`[meta-poster] Listing Instagram media for user ${igUserId}...`);

  const data = await graphApiRequest<{
    data: Array<{
      id: string;
      caption?: string;
      media_url?: string;
      permalink?: string;
      timestamp?: string;
    }>;
  }>(
    "GET",
    `/${igUserId}/media`,
    { fields: "id,caption,media_url,permalink,timestamp", limit: String(limit) },
    undefined,
    token,
  );

  console.log(`[meta-poster] Found ${data.data?.length ?? 0} IG media items`);

  return (data.data ?? []).map((item) => ({
    id: item.id,
    caption: item.caption,
    media_url: item.media_url,
    permalink: item.permalink,
    timestamp: item.timestamp,
  }));
}

/**
 * Resolve the real IG Media ID for a newly published post.
 *
 * After publishing via media_publish, Meta sometimes returns the container
 * creation ID instead of the real IG Media ID. Container IDs cannot be used
 * for DELETE operations (error code 100 "Object does not exist").
 *
 * This function queries the recent media list and matches by caption
 * to find the actual, delete-able IG Media ID.
 *
 * Falls back gracefully: if listing fails, returns the publishResultId
 * as-is so posting still succeeds even if deletion might not.
 */
async function resolveRealIgMediaId(
  igUserId: string,
  publishResultId: string,
  caption: string,
): Promise<string> {
  // Normalize caption for comparison: first 80 chars, trim whitespace
  const normalizedCaption = caption.trim().substring(0, 80);

  try {
    // Small delay to let Meta's systems propagate the new media
    await new Promise((r) => setTimeout(r, 3000));

    const media = await listInstagramMedia(igUserId, 10);

    for (const item of media) {
      const itemCaption = (item.caption ?? "").trim().substring(0, 80);
      if (itemCaption === normalizedCaption) {
        console.log(
          `[meta-poster] Resolved real IG Media ID: ${item.id} (publish gave: ${publishResultId})`,
        );
        return item.id;
      }
    }

    // If no caption match, check if publishResultId appears in the list at all
    for (const item of media) {
      if (item.id === publishResultId) {
        console.log(
          `[meta-poster] Publish result ID ${publishResultId} found in media list — using as-is`,
        );
        return publishResultId;
      }
    }

    // No match found — log warning and return the publish result ID
    console.warn(
      `[meta-poster] ⚠️ Could not find real IG Media ID for caption "${normalizedCaption}". ` +
        `Publish returned ${publishResultId}. Media list had ${media.length} items. ` +
        `Storing publish result ID — deletion may fail if it's a container ID.`,
    );
  } catch (err: any) {
    console.warn(
      `[meta-poster] ⚠️ Failed to resolve real IG Media ID: ${err.message}. ` +
        `Falling back to publish result ID ${publishResultId}.`,
    );
  }

  return publishResultId;
}

/**
 * Delete an Instagram post by its media ID.
 *
 * Uses the Meta Graph API DELETE endpoint on the IG media object.
 * The media ID must be the real IG Media ID (from listInstagramMedia or
 * resolved via resolveRealIgMediaId), NOT a container creation ID.
 *
 * Reference: https://developers.facebook.com/docs/instagram-api/reference/ig-media#delete
 */
export async function deleteInstagramPost(igMediaId: string): Promise<void> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    throw new Error("META_ACCESS_TOKEN is not set");
  }

  console.log(`[meta-poster] Deleting Instagram post: ${igMediaId}`);

  // DELETE /{ig-media-id}?access_token={token}
  await graphApiRequest("DELETE", `/${igMediaId}`, undefined, undefined, token);

  console.log(`[meta-poster] ✅ DELETED Instagram post: ${igMediaId}`);
}
