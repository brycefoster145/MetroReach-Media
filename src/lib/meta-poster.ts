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
  method: "GET" | "POST",
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

  if (method === "POST" && body) {
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
 * Uses the system user token to exchange for a page token.
 */
export async function getPageAccessToken(
  pageId: string,
): Promise<string> {
  const systemToken = process.env.META_ACCESS_TOKEN;
  if (!systemToken) {
    throw new Error("META_ACCESS_TOKEN is not set");
  }

  const data = await graphApiRequest<{ access_token: string }>(
    "GET",
    `/${pageId}`,
    { fields: "access_token" },
    undefined,
    systemToken,
  );

  if (!data.access_token) {
    throw new Error(`No access_token returned for page ${pageId}`);
  }

  return data.access_token;
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

  const pageToken = await getPageAccessToken(
    process.env.META_FB_PAGE_ID || "623055204204992",
  );

  // Step 1: Create media container
  const mediaBody: Record<string, unknown> = {
    caption: text,
    image_url: mediaUrls[0],
  };

  // Step 2: Publish the container
  const publishResult = await graphApiRequest<{ id: string }>(
    "POST",
    `/${igUserId}/media_publish`,
    undefined,
    { creation_id: container.id },
    pageToken,
  );

  return {
    post_id: publishResult.id,
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
