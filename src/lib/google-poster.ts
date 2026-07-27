/**
 * Google (GMB + YouTube) direct posting utility.
 *
 * Posts directly via Google My Business API v4 and YouTube Data API v3
 * using the client's stored OAuth 2.0 tokens from client_platform_tokens.
 * Used by the posting scheduler to publish scheduled Google posts at exact times.
 *
 * No third-party middleware — direct Google API calls.
 */
import { sql } from "~/lib/db";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMB_API_BASE = "https://mybusinessbusinessinformation.googleapis.com";
const YOUTUBE_UPLOAD_BASE = "https://www.googleapis.com/upload/youtube/v3";

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

/**
 * Refresh an expired Google access token using the stored refresh token.
 */
async function refreshGoogleToken(clientId: string): Promise<string> {
  const rows = await sql`
    SELECT access_token, page_id
    FROM client_platform_tokens
    WHERE client_id = ${clientId}
      AND platform = 'google'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (rows.length === 0) {
    throw new Error(
      `No Google token found for client ${clientId}. Have they connected via the portal?`,
    );
  }

  const refreshToken = rows[0].page_id as string;
  if (!refreshToken || refreshToken === "primary") {
    // Token was stored without a refresh token; use existing access token
    return rows[0].access_token as string;
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const json = await res.json();
  if (json.error) {
    throw new Error(
      `Google token refresh failed: ${json.error_description || json.error}`,
    );
  }

  const newToken = json.access_token;
  const expiresIn = json.expires_in ?? 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  // Update stored access token
  await sql`
    UPDATE client_platform_tokens
    SET access_token = ${newToken},
        expires_at = ${expiresAt.toISOString()}
    WHERE client_id = ${clientId}
      AND platform = 'google'
      AND page_id = ${refreshToken}
  `;

  // Also update tokens for all sub-platforms (gmb, youtube)
  await sql`
    UPDATE client_platform_tokens
    SET access_token = ${newToken},
        expires_at = ${expiresAt.toISOString()}
    WHERE client_id = ${clientId}
      AND platform IN ('google_gmb', 'google_youtube')
  `;

  return newToken;
}

/**
 * Get a valid access token for a client (refreshing if needed).
 */
async function getValidAccessToken(clientId: string): Promise<string> {
  const rows = await sql`
    SELECT access_token
    FROM client_platform_tokens
    WHERE client_id = ${clientId}
      AND platform = 'google'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (rows.length === 0) {
    throw new Error(
      `No Google token found for client ${clientId}. Have they connected via the portal?`,
    );
  }

  try {
    return await refreshGoogleToken(clientId);
  } catch {
    // Fall back to stored token
    return rows[0].access_token as string;
  }
}

// ---------------------------------------------------------------------------
// GMB posting
// ---------------------------------------------------------------------------

/**
 * Publish a text (+ optional image) post to a Google My Business listing.
 *
 * @param accessToken  Valid Google OAuth access token.
 * @param locationPath GMB location path (e.g. "accounts/123456/locations/789012").
 * @param text         Post text (max 1,500 characters).
 * @param mediaUrls    Optional public image URLs to attach.
 */
async function publishGMBPost(
  accessToken: string,
  locationPath: string,
  text: string,
  mediaUrls?: string[],
): Promise<{ post_id: string; platform: string }> {
  const summary = text.length > 1500 ? text.slice(0, 1497) + "..." : text;

  const postBody: Record<string, unknown> = {
    summary,
    topicType: "STANDARD",
    languageCode: "en-US",
  };

  // Attach first image as media if provided
  if (mediaUrls && mediaUrls.length > 0) {
    const mediaItem = await uploadGMBMedia(accessToken, locationPath, mediaUrls[0]);
    if (mediaItem) {
      postBody.media = [mediaItem];
    }
  }

  const res = await fetch(
    `${GMB_API_BASE}/v1/${locationPath}/localPosts`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postBody),
    },
  );

  const json = await res.json();
  if (json.error) {
    throw new Error(
      `GMB post creation failed: ${json.error.message || JSON.stringify(json.error)}`,
    );
  }

  return {
    post_id: json.name ?? "unknown",
    platform: "google_my_business",
  };
}

/**
 * Upload an image to GMB for use in a local post.
 */
async function uploadGMBMedia(
  accessToken: string,
  locationPath: string,
  imageUrl: string,
): Promise<{ mediaFormat: string; sourceUrl: string } | null> {
  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return null;

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    const uploadRes = await fetch(
      `${GMB_API_BASE}/v1/${locationPath}/media?alt=media`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": contentType,
          "X-Goog-Upload-Protocol": "raw",
        },
        body: buffer,
      },
    );

    const uploadJson = await uploadRes.json();
    if (uploadJson.error) return null;

    const mediaName = uploadJson.name ?? "";
    if (!mediaName) return null;

    return {
      mediaFormat: "PHOTO",
      sourceUrl: `${GMB_API_BASE}/v1/${mediaName}`,
    };
  } catch {
    return null; // Media upload is optional; post still publishes without it
  }
}

// ---------------------------------------------------------------------------
// YouTube posting (video upload)
// ---------------------------------------------------------------------------

/**
 * Upload a video to YouTube.
 *
 * Expects the first entry in mediaUrls to be a publicly accessible video URL.
 * Falls back to a text-only community-style approach if no video URL is provided.
 *
 * @param accessToken Valid Google OAuth access token.
 * @param channelId   YouTube channel ID.
 * @param text        Video title (or fallback text).
 * @param mediaUrls   Optional array — first element treated as video URL.
 */
async function publishYouTubeVideo(
  accessToken: string,
  channelId: string,
  text: string,
  mediaUrls?: string[],
): Promise<{ post_id: string; platform: string }> {
  const videoUrl = mediaUrls?.[0];

  if (!videoUrl) {
    throw new Error(
      "YouTube posts require a video URL in media_urls. " +
      "Text-only YouTube community posts are not yet supported via this scheduler.",
    );
  }

  const title = text.split("\n")[0].slice(0, 100);
  const description = text.length > title.length
    ? text.slice(title.length).trim().slice(0, 5000)
    : "";

  // Step 1: Download the video from the public URL
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) {
    throw new Error(
      `Failed to fetch video from ${videoUrl}: HTTP ${videoRes.status}`,
    );
  }

  const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
  const videoContentType = videoRes.headers.get("content-type") ?? "video/mp4";

  // Step 2: Build multipart upload body
  const metadata = {
    snippet: {
      title,
      description,
    },
    status: {
      privacyStatus: "private",
      selfDeclaredMadeForKids: false,
    },
  };

  const boundary = `----MetroReachYT${Date.now()}${Math.random().toString(36).slice(2)}`;
  const parts: Buffer[] = [];

  // Part 1: metadata
  parts.push(
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n`,
    ),
  );

  // Part 2: video
  parts.push(
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Type: ${videoContentType}\r\n\r\n`,
    ),
  );
  parts.push(videoBuffer);
  parts.push(Buffer.from(`\r\n`));

  // Closing boundary
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const multipartBody = Buffer.concat(parts);

  const uploadRes = await fetch(
    `${YOUTUBE_UPLOAD_BASE}/videos?part=snippet,status`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    },
  );

  const uploadJson = await uploadRes.json();
  if (uploadJson.error) {
    throw new Error(
      `YouTube upload failed: ${uploadJson.error.message || JSON.stringify(uploadJson.error)}`,
    );
  }

  return {
    post_id: uploadJson.id ?? "unknown",
    platform: "youtube",
  };
}

// ---------------------------------------------------------------------------
// Main publish function
// ---------------------------------------------------------------------------

export interface GooglePostResult {
  post_id: string;
  platform: string;
}

/**
 * Publish a scheduled post to Google (GMB or YouTube).
 *
 * Determines the subtype from the accountId format:
 *   - Contains "/locations/" → Google My Business post
 *   - Otherwise → YouTube video upload
 *
 * @param clientId   The MetroReach client ID (from scheduled_posts.client_id).
 * @param accountId  The Google account/location ID (from scheduled_posts.page_id).
 *                   For GMB: "accounts/X/locations/Y". For YouTube: channel ID.
 * @param text       Post text (for GMB) or video title + description (for YouTube).
 * @param mediaUrls  Optional media URLs. For GMB: first URL = image. For YouTube: first URL = video.
 */
export async function publishToGoogle(
  clientId: string,
  accountId: string,
  text: string,
  mediaUrls?: string[],
): Promise<GooglePostResult> {
  const accessToken = await getValidAccessToken(clientId);

  if (accountId.includes("/locations/")) {
    // Google My Business post
    return publishGMBPost(accessToken, accountId, text, mediaUrls);
  }

  // YouTube video upload
  return publishYouTubeVideo(accessToken, accountId, text, mediaUrls);
}
