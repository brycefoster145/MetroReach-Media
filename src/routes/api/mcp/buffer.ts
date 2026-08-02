/**
 * MCP (Model Context Protocol) route for the Buffer API.
 *
 * Implements JSON-RPC 2.0 over HTTP at POST /api/mcp/buffer.
 * Wraps the Buffer GraphQL API (https://developers.buffer.com)
 * for scheduling and managing social media posts across connected channels.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 *
 * Tools exposed:
 *   buffer_get_user             — verify the Buffer connection and return the account profile
 *   buffer_list_profiles        — list all connected social accounts (channels)
 *   buffer_create_post          — schedule or publish a post to one or more profiles
 *   buffer_list_pending_updates — list pending scheduled updates
 *   buffer_delete_update        — delete/destroy a scheduled update
 *
 * Platform metadata (verified against Buffer's live schema 2026-08):
 *   - Facebook requires  metadata.facebook.type  (PostTypeFacebook: post|reel|story)
 *   - Instagram requires metadata.instagram.type (PostType: post|carousel|reel|story|...)
 *     AND metadata.instagram.shouldShareToFeed, plus at least one image/video asset
 *   - LinkedIn has NO type field (PostTypeLinkedIn does not exist) — `linkedin: {}`
 *     satisfies the input.
 *   - There is no createAsset/uploadAsset mutation; assets are always already-hosted
 *     public URLs (assets: [{ image: { url } }] or the { url } shorthand).
 */

import { createFileRoute } from "@tanstack/react-router";
import { requireMcpAuth } from "~/lib/mcp-auth";
import { sql } from "~/lib/db";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BUFFER_API_BASE = "https://api.buffer.com";
const SERVER_NAME = "mcp-buffer";
const SERVER_VERSION = "1.0.0";

/**
 * Resolve the Buffer access token.
 *
 * Priority: BUFFER_ACCESS_TOKEN env var first (set in Vercel), then the
 * DB-stored token written by the Buffer OAuth callback
 * (/api/portal/buffer-oauth-callback → buffer_credentials table).
 *
 * Throws a clear, actionable error when neither is available so tool calls
 * fail with an obvious message instead of a confusing 401.
 */
async function getBufferAccessToken(): Promise<string> {
  const envToken = process.env.BUFFER_ACCESS_TOKEN ?? "";
  if (envToken) return envToken;

  try {
    const rows = await sql`
      SELECT access_token FROM buffer_credentials WHERE id = 'default' LIMIT 1
    `;
    const token = rows?.[0]?.access_token;
    if (token) return token;
  } catch (err: any) {
    console.error("buffer_credentials lookup failed:", err.message);
  }

  throw new Error(
    "Buffer access token is not available. Either set BUFFER_ACCESS_TOKEN in the " +
      "Vercel environment or complete the Buffer OAuth flow at " +
      "/api/portal/buffer-oauth-start (which stores the token in buffer_credentials)."
  );
}

// ---------------------------------------------------------------------------
// Buffer API request helper
// ---------------------------------------------------------------------------

/**
 * Flatten a params object into key/value string pairs the way Buffer's
 * form-encoded API expects:
 *   - arrays become repeated `key[]=` params (e.g. profile_ids[])
 *   - nested objects become `key[sub]=` params (e.g. media[link])
 */
function flattenParams(
  params: Record<string, unknown>,
): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null) continue;
        entries.push([`${key}[]`, String(item)]);
      }
    } else if (typeof value === "object") {
      for (const [subKey, subVal] of Object.entries(
        value as Record<string, unknown>,
      )) {
        if (subVal === undefined || subVal === null) continue;
        entries.push([`${key}[${subKey}]`, String(subVal)]);
      }
    } else {
      entries.push([key, String(value)]);
    }
  }
  return entries;
}

/**
 * Convert a tool argument into a Buffer GraphQL dueAt value (ISO 8601
 * string, UTC). The GraphQL API accepts ISO 8601 strings only — it dropped
 * REST's unix-seconds format — so unix second numbers / numeric strings are
 * converted here. Accepts ISO 8601 strings ("2026-08-05T14:00:00Z"),
 * unix second numbers, or numeric strings.
 */
function toIsoString(value: string | number): string {
  if (typeof value === "number") {
    return new Date(value * 1000).toISOString();
  }
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return new Date(Number(trimmed) * 1000).toISOString();
  }
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) {
    throw new Error(
      `Invalid scheduled_at/since: "${value}" — expected an ISO 8601 timestamp or unix seconds.`
    );
  }
  return new Date(ms).toISOString();
}

/**
 * Make a request to the Buffer GraphQL API
 * (https://api.buffer.com/graphql). Auth is passed as a Bearer token in the
 * Authorization header. POST bodies are JSON: { query, variables }.
 */
async function bufferGraphqlRequest<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = await getBufferAccessToken();
  const res = await fetch(BUFFER_API_BASE, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  let json: { data?: T; errors?: Array<{ message?: string; extensions?: { code?: string } }> };
  try { json = JSON.parse(text) as typeof json; }
  catch { throw new Error(`Buffer API returned non-JSON response (status ${res.status}): ${text.slice(0, 500)}`); }
  if (!res.ok || json.errors?.length) {
    const error = json.errors?.[0];
    throw new Error(`Buffer GraphQL error: ${error?.message ?? `HTTP ${res.status}`} (${error?.extensions?.code ?? "unknown"})`);
  }
  if (json.data === undefined) throw new Error("Buffer GraphQL response did not contain data");
  return json.data;
}

/** GraphQL replacement for the retired REST request helper. */
async function bufferApiRequest<T = unknown>(method: "GET" | "POST", path: string, params?: Record<string, unknown>): Promise<T> {
  if (method === "GET" && path === "/1/user.json") {
    return bufferGraphqlRequest<T>(`query GetAccount { account { id email name organizations { id name } } }`);
  }
  throw new Error(`Buffer GraphQL migration required for unsupported legacy resource: ${method} ${path}`);
}

/** Default Buffer organization for this agency account (overridable via BUFFER_ORGANIZATION_ID). */
const DEFAULT_ORGANIZATION_ID = "6a603e49b90c45bdaab82cee";

/** Resolve the Buffer organization ID to scope posts queries to. */
function getOrganizationId(): string {
  return process.env.BUFFER_ORGANIZATION_ID ?? DEFAULT_ORGANIZATION_ID;
}

/**
 * Wraps bufferGraphqlRequest with a single retry for Buffer's aggressive
 * rate limiting (observed RATE_LIMIT responses that can persist for minutes).
 * Retries once after a short delay, then rethrows so the caller sees the error.
 */
async function bufferGraphqlRequestWithRetry<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
  retries = 1,
): Promise<T> {
  try {
    return await bufferGraphqlRequest<T>(query, variables);
  } catch (err: any) {
    const message = err?.message ?? String(err);
    if (retries > 0 && message.includes("RATE_LIMIT")) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return bufferGraphqlRequest<T>(query, variables);
    }
    throw err;
  }
}
// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

/** Query account — verify the connection and return the Buffer account. */
async function getUser() {
  const data = await bufferApiRequest<Record<string, unknown>>(
    "GET",
    "/1/user.json",
  );
  return {
    user: data,
    connected: true,
    message:
      "Buffer connection verified. Token is valid and maps to the account above.",
  };
}

/** GET /1/profiles.json — list all connected social accounts (channels). */
async function listProfiles() {
  const account = await bufferGraphqlRequest<{ account: { organizations?: Array<{ id: string }> } }>(
    `query GetOrganizations { account { organizations { id } } }`,
  );
  const organizations = account.account?.organizations ?? [];
  const profiles: Array<Record<string, unknown>> = [];
  for (const organization of organizations) {
    const data = await bufferGraphqlRequest<{ channels?: { edges?: Array<{ node: Record<string, unknown> }> } | Array<Record<string, unknown>> }>(
      `query GetChannels($organizationId: OrganizationId!) { channels(input: { organizationId: $organizationId }) { id name displayName service avatar isQueuePaused } }`,
      { organizationId: organization.id },
    );
    const channels = data.channels;
    if (Array.isArray(channels)) profiles.push(...channels);
    else profiles.push(...(channels?.edges ?? []).map((edge) => edge.node));
  }
  return { total: profiles.length, profiles };
}

// ---------------------------------------------------------------------------
// Platform metadata + asset helpers (verified against Buffer's live schema)
// ---------------------------------------------------------------------------

/**
 * Default platform metadata injected by createPost when the caller doesn't
 * provide a service-specific metadata object. Verified live 2026-08:
 *   - FacebookPostMetadataInput requires `type` (PostTypeFacebook: post|reel|story)
 *   - InstagramPostMetadataInput requires `type` (PostType: post|carousel|reel|story|...)
 *     AND `shouldShareToFeed` (Boolean!)
 *   - LinkedInPostMetadataInput has NO `type` field (a PostTypeLinkedIn enum does
 *     not exist in Buffer's schema) — an empty object satisfies the input.
 */
const DEFAULT_CHANNEL_METADATA: Record<string, Record<string, unknown>> = {
  facebook: { type: "post" },
  instagram: { type: "post", shouldShareToFeed: true },
  linkedin: {},
};

/**
 * Normalize a caller-provided asset into Buffer's AssetInput shape.
 * Accepts the GraphQL-native form ({ image: { url }, video: {...}, ... }) or
 * the shorthand used by callers: { url: "https://..." } or a bare URL string,
 * both of which map to an image asset.
 *
 * Buffer has NO createAsset/uploadAsset mutation (verified via schema
 * introspection — the only mutations are createPost/deletePost/editPost/
 * movePostInQueue/templates/ideas), so assets are ALWAYS referenced by an
 * already-hosted public URL.
 */
function normalizeAsset(asset: unknown): Record<string, unknown> {
  if (typeof asset === "string") return { image: { url: asset } };
  if (asset && typeof asset === "object") {
    const a = asset as Record<string, unknown>;
    if (typeof a.url === "string") return { image: { url: a.url } };
    // Already in AssetInput form ({ image | video | link | document })
    return a;
  }
  throw new Error(
    'Invalid asset — expected { url: "https://..." }, { image: { url: "..." } }, or a URL string'
  );
}

/**
 * Resolve the Buffer service (facebook, instagram, linkedin, twitter, ...) for
 * a set of channel IDs with a SINGLE GraphQL query (channels returns a plain
 * list — the old `edges` shape is gone). Falls back to an empty map if the
 * query fails so callers' explicit metadata still passes through untouched.
 */
async function resolveChannelServices(profileIds: string[]): Promise<Map<string, string>> {
  const services = new Map<string, string>();
  try {
    const data = await bufferGraphqlRequest<{ channels?: Array<{ id: string; service: string }> }>(
      `query GetChannelServices($organizationId: OrganizationId!) {
        channels(input: { organizationId: $organizationId }) { id service }
      }`,
      { organizationId: getOrganizationId() },
    );
    for (const channel of data.channels ?? []) {
      if (profileIds.includes(channel.id)) services.set(channel.id, channel.service);
    }
  } catch (err: any) {
    console.error(
      "resolveChannelServices failed — continuing without service detection:",
      err?.message ?? err,
    );
  }
  return services;
}

/**
 * Create (schedule or immediately publish) a post via the Buffer GraphQL
 * createPost mutation. The GraphQL API accepts ONE channel per call
 * (channelId), so one mutation is issued per profile/channel ID — the
 * REST-era multi-profile batching is gone. Buffer rate-limits aggressively,
 * so the loop is sequential (never parallel) and a single short retry is
 * attempted on RATE_LIMIT before the error surfaces.
 *
 * Scheduling semantics (mapped from REST args):
 *   - scheduled_at (ISO 8601 or unix seconds) → dueAt (ISO 8601), mode customScheduled
 *   - now: true                                → mode shareNow (publish immediately, no dueAt)
 *   - neither given                            → mode addToQueue (end of queue)
 *   - top: true (only when no explicit time)   → mode shareNext (top of queue)
 *
 * Platform metadata (Buffer REQUIRES it for FB/IG):
 *   - channel service is resolved once via a single channels query, then
 *     DEFAULT_CHANNEL_METADATA is injected per service unless the caller
 *     overrides it with the `metadata` argument (deep-merged so required
 *     fields like instagram.shouldShareToFeed are always present).
 *   - Instagram also requires at least one image/video — createPost fails
 *     fast with a clear message when an IG channel has no assets instead of
 *     relying on Buffer's rejection.
 *
 * Media:
 *   - `assets` accepts an array of { url } / { image: { url } } / URL strings
 *     (Buffer has no asset upload mutation — URLs must already be hosted).
 *   - `media_link` is mapped to an image asset for backward compatibility.
 *   - media_title / media_description / media_picture are NOT supported by
 *     createPost and are ignored with a warning; shorten_links likewise.
 */
async function createPost(args: {
  profile_ids: string[];
  text: string;
  media_link?: string;
  media_title?: string;
  media_description?: string;
  media_picture?: string;
  assets?: unknown[];
  metadata?: Record<string, unknown>;
  scheduled_at?: string | number;
  now?: boolean;
  top?: boolean;
  shorten_links?: boolean;
}) {
  if (!args.profile_ids || args.profile_ids.length === 0) {
    throw new Error("profile_ids is required and must contain at least one profile ID");
  }
  if (!args.text || !args.text.trim()) {
    throw new Error("text is required");
  }

  // Decide the scheduling mode once; applies to every channel.
  let mode: "customScheduled" | "shareNow" | "addToQueue" | "shareNext" = "addToQueue";
  let dueAt: string | null = null;
  if (args.scheduled_at !== undefined && args.scheduled_at !== null) {
    mode = "customScheduled";
    dueAt = toIsoString(args.scheduled_at);
  } else if (args.now) {
    mode = "shareNow";
  } else if (args.top) {
    mode = "shareNext";
  }

  // Collect assets: explicit assets[] first, then legacy media_link as an image.
  const warnings: string[] = [];
  const assets: Array<Record<string, unknown>> = [];
  if (args.assets && args.assets.length > 0) {
    for (const asset of args.assets) assets.push(normalizeAsset(asset));
  } else if (args.media_link) {
    assets.push({ image: { url: args.media_link } });
  }
  if (args.media_title || args.media_description || args.media_picture) {
    warnings.push(
      "media_title/media_description/media_picture are not supported by the Buffer GraphQL " +
        "createPost mutation and were ignored."
    );
  }
  if (args.shorten_links) {
    warnings.push("shorten_links is not supported by the Buffer GraphQL createPost mutation and was ignored.");
  }

  // Resolve each channel's service once (single query) so platform metadata
  // can be injected per channel.
  const services = await resolveChannelServices(args.profile_ids);

  const created: Array<Record<string, unknown>> = [];
  for (const channelId of args.profile_ids) {
    const service = services.get(channelId) ?? null;

    // Instagram requires at least one image or video — fail fast with a clear
    // message instead of an opaque Buffer rejection.
    if (service === "instagram" && assets.length === 0) {
      throw new Error(
        `Instagram channel ${channelId} requires at least one image or video: pass ` +
          'assets: [{ url: "https://..." }] (or media_link). Buffer: "Instagram posts ' +
          'require at least one image or video."'
      );
    }

    // Build metadata: per-service defaults first, caller values merged on top
    // so required fields (e.g. instagram.shouldShareToFeed) are always present.
    const metadata: Record<string, unknown> = {};
    if (service && DEFAULT_CHANNEL_METADATA[service]) {
      metadata[service] = { ...DEFAULT_CHANNEL_METADATA[service] };
    }
    if (args.metadata) {
      for (const [platform, platformMeta] of Object.entries(args.metadata)) {
        if (platformMeta && typeof platformMeta === "object" && !Array.isArray(platformMeta)) {
          const existing = metadata[platform];
          metadata[platform] = {
            ...(existing && typeof existing === "object" && !Array.isArray(existing)
              ? (existing as Record<string, unknown>)
              : {}),
            ...(platformMeta as Record<string, unknown>),
          };
        } else {
          metadata[platform] = platformMeta;
        }
      }
    }

    const input: Record<string, unknown> = {
      channelId,
      text: args.text,
      assets,
      mode,
      needsApproval: false,
      schedulingType: "automatic",
    };
    if (dueAt) input.dueAt = dueAt;
    if (Object.keys(metadata).length > 0) input.metadata = metadata;

    const data = await bufferGraphqlRequestWithRetry<{
      createPost?: { post?: { id?: string }; message?: string };
    }>(
      `mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
          ... on PostActionSuccess {
            post { id }
          }
          ... on InvalidInputError { message }
          ... on NotFoundError { message }
          ... on UnauthorizedError { message }
          ... on UnexpectedError { message }
          ... on RestProxyError { message }
          ... on LimitReachedError { message }
        }
      }`,
      { input },
    );

    const result = data.createPost;
    // Buffer returned an error union member (InvalidInputError, etc.) instead
    // of PostActionSuccess — surface the actual reason to the caller.
    if (!result?.post?.id && result?.message) {
      throw new Error(`Buffer rejected post for channel ${channelId}: ${result.message}`);
    }

    created.push({
      profile_id: channelId,
      service,
      post_id: result?.post?.id ?? null,
      mode,
      due_at: dueAt,
    });
  }

  return {
    success: true,
    created,
    total_created: created.length,
    profiles: args.profile_ids,
    scheduled_at: dueAt ?? (args.now ? "immediate" : mode === "shareNext" ? "next_in_queue" : "queue_end"),
    warnings,
  };
}

/**
 * List scheduled posts via the Buffer GraphQL posts query. profile_ids map
 * to channel IDs in the new API. Timestamps come back as ISO 8601 UTC
 * strings (GraphQL has no unix-seconds mode, so the old `utc` flag is
 * accepted and ignored — output is always UTC).
 */
async function listPendingUpdates(args: {
  profile_ids?: string[];
  count?: number;
  since?: string | number;
  utc?: boolean;
}) {
  const filter: Record<string, unknown> = { status: ["scheduled"] };
  if (args.profile_ids && args.profile_ids.length > 0) {
    filter.channelIds = args.profile_ids;
  }
  if (args.since !== undefined && args.since !== null) {
    filter.dueAt = { start: toIsoString(args.since) };
  }

  const input: Record<string, unknown> = {
    organizationId: getOrganizationId(),
    filter,
  };

  const data = await bufferGraphqlRequest<{
    posts?: { edges?: Array<{ node: Record<string, unknown> }> };
  }>(
    `query ListPending($input: PostsInput!, $first: Int) {
      posts(input: $input, first: $first) {
        edges { node { id text dueAt status channelId channelService } }
      }
    }`,
    { input, first: args.count },
  );

  const updates = (data.posts?.edges ?? []).map((edge) => edge.node);
  return {
    total: updates.length,
    updates,
    limit: args.count,
  };
}

/** Delete a scheduled post via the Buffer GraphQL deletePost mutation. */
async function deleteUpdate(args: { update_id: string }) {
  if (!args.update_id) {
    throw new Error("update_id is required");
  }
  const data = await bufferGraphqlRequest<{ deletePost?: { id?: string } }>(
    `mutation DeletePost($input: DeletePostInput!) {
      deletePost(input: $input) {
        ... on DeletePostSuccess {
          id
        }
      }
    }`,
    { input: { id: args.update_id } },
  );
  return {
    success: true,
    update_id: args.update_id,
    deleted: true,
    returned_id: data.deletePost?.id ?? null,
  };
}

// ---------------------------------------------------------------------------
// Tool registry (MCP tools/list schema)
// ---------------------------------------------------------------------------

interface ToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (args: any) => Promise<unknown>;
}

const tools: ToolDef[] = [
  {
    name: "buffer_get_user",
    description:
      "Verify the Buffer connection and return the authenticated Buffer account profile. " +
      "Use this as a health check before any other Buffer tool — it confirms the " +
      "BUFFER_ACCESS_TOKEN is valid and reports which account is connected.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    handler: getUser,
  },
  {
    name: "buffer_list_profiles",
    description:
      "List all social media accounts (channels) connected to the Buffer account. " +
      "Returns each profile's ID, service (facebook, instagram, twitter, linkedin, etc.), " +
      "username, avatar, and stats. Use profile IDs from this tool as the profile_ids " +
      "argument for buffer_create_post.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    handler: listProfiles,
  },
  {
    name: "buffer_create_post",
    description:
      "Schedule a post to one or more Buffer-connected channels via the GraphQL API. " +
      "Requires profile_ids (array of channel IDs from buffer_list_profiles) and text. " +
      "One post is created per channel ID — the GraphQL API accepts a single channelId " +
      "per call, and Buffer rate-limits aggressively, so expect one API call per channel. " +
      "Optionally pass scheduled_at (ISO 8601 timestamp OR unix seconds; converted to " +
      "ISO 8601 for GraphQL). When scheduled_at is omitted the post is added to the end of " +
      "the queue, or publishes immediately with now=true. " +
      "PLATFORM METADATA (handled automatically): Buffer requires per-platform metadata " +
      "for Facebook and Instagram. The bridge detects each channel's service and injects " +
      "metadata: { facebook: { type: post } } or { instagram: { type: post, shouldShareToFeed: true } } " +
      "by default; pass the `metadata` argument to override (e.g. metadata: { facebook: { type: reel } } — " +
      "caller values are deep-merged over defaults so required fields are preserved). " +
      "LinkedIn accepts metadata: { linkedin: {} } (no type field exists). " +
      "IMAGES: Instagram requires at least one image/video — pass assets: [{ url: \"https://...\" }] " +
      "(or the legacy media_link). Assets are already-hosted public URLs only (Buffer has no " +
      "asset-upload mutation); { image: { url } }, { video: { url } }, and { link: { url } } forms are " +
      "accepted too. IG posts without any asset fail fast with a clear message. " +
      "LIMITATIONS: media_title/media_description/media_picture are NOT supported by the GraphQL " +
      "createPost mutation and are ignored with a warning; shorten_links is ignored; top=true maps " +
      "to 'share next' and is only honored when no explicit schedule time is given.",
    inputSchema: {
      type: "object",
      properties: {
        profile_ids: {
          type: "array",
          items: { type: "string" },
          description: "Buffer profile IDs to post to (from buffer_list_profiles).",
        },
        text: {
          type: "string",
          description: "The post text. Must be in MetroReach Media brand voice.",
        },
        media_link: {
          type: "string",
          description:
            "Optional publicly accessible image URL to attach to the post. Maps to an image asset.",
        },
        media_title: {
          type: "string",
          description: "Optional media title (e.g. for link previews). NOT supported by GraphQL; ignored.",
        },
        media_description: {
          type: "string",
          description: "Optional media description (e.g. for link previews). NOT supported by GraphQL; ignored.",
        },
        media_picture: {
          type: "string",
          description: "Optional media picture URL (e.g. for link previews). NOT supported by GraphQL; ignored.",
        },
        assets: {
          type: "array",
          items: { type: "object" },
          description:
            "Optional array of already-hosted media URLs. Each item may be " +
            '{ url: "https://..." } (shorthand → image), { image: { url } }, { video: { url } }, ' +
            "{ link: { url } }, or a plain URL string. Instagram REQUIRES at least one asset.",
        },
        metadata: {
          type: "object",
          description:
            "Optional per-platform metadata, e.g. { facebook: { type: reel } } or " +
            "{ instagram: { type: reel, shouldShareToFeed: false } }. Deep-merged over the " +
            "bridge's automatic defaults (facebook type=post; instagram type=post, " +
            "shouldShareToFeed=true; linkedin {}).",
        },
        scheduled_at: {
          type: "string",
          description:
            "Optional ISO 8601 timestamp or unix seconds to schedule the post. If omitted, the post goes to the top of the queue (or publishes immediately with now=true).",
        },
        now: {
          type: "boolean",
          description: "If true, publish the post immediately instead of scheduling.",
        },
        top: {
          type: "boolean",
          description: "If true, put the post at the top of the buffer queue.",
        },
        shorten_links: {
          type: "boolean",
          description: "If true, automatically shorten links in the post text. NOT supported by GraphQL; ignored.",
        },
      },
      required: ["profile_ids", "text"],
    },
    handler: createPost,
  },
  {
    name: "buffer_list_pending_updates",
    description:
      "List pending (scheduled, not yet published) posts in the Buffer queue via the GraphQL API. " +
      "Optionally filter by profile_ids (channel IDs) and limit with count. " +
      "Returns the total count and each post's id, text, status, dueAt (ISO 8601 UTC), " +
      "channelId, and channelService. Use the returned ids with buffer_delete_update to cancel posts.",
    inputSchema: {
      type: "object",
      properties: {
        profile_ids: {
          type: "array",
          items: { type: "string" },
          description: "Optional Buffer profile IDs to filter pending updates by.",
        },
        count: {
          type: "number",
          description: "Maximum number of updates to return. Default: all pending.",
        },
        since: {
          type: "string",
          description: "Optional ISO 8601 timestamp or unix seconds — only return updates scheduled after this time.",
        },
        utc: {
          type: "boolean",
          description: "If true, return timestamps in UTC.",
        },
      },
      required: [],
    },
    handler: listPendingUpdates,
  },
  {
    name: "buffer_delete_update",
    description:
      "Delete (destroy) a scheduled update from the Buffer queue so it never publishes. " +
      "Requires the update_id (obtain from buffer_list_pending_updates). " +
      "Returns confirmation of deletion.",
    inputSchema: {
      type: "object",
      properties: {
        update_id: {
          type: "string",
          description: "The Buffer update ID to delete (from buffer_list_pending_updates).",
        },
      },
      required: ["update_id"],
    },
    handler: deleteUpdate,
  },
];

// ---------------------------------------------------------------------------
// JSON-RPC dispatcher
// ---------------------------------------------------------------------------

type RpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

/** Return a JSON-RPC 2.0 error response. */
function jsonRpcError(
  id: unknown,
  code: number,
  message: string,
): Record<string, unknown> {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message },
  };
}

async function dispatch(req: RpcRequest): Promise<unknown> {
  const { method, params, id } = req;

  switch (method) {
    // --- MCP lifecycle ---
    case "initialize": {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION,
          },
        },
      };
    }

    case "notifications/initialized": {
      // No response required per MCP spec
      return null;
    }

    // --- MCP tools ---
    case "tools/list": {
      const toolList = tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
      return { jsonrpc: "2.0", id, result: { tools: toolList } };
    }

    case "tools/call": {
      const toolName = params?.name as string | undefined;
      const toolArgs = (params?.arguments ?? {}) as Record<string, unknown>;

      if (!toolName) {
        return jsonRpcError(id, -32602, 'Missing required param "name"');
      }

      const tool = tools.find((t) => t.name === toolName);
      if (!tool) {
        return jsonRpcError(id, -32601, `Unknown tool: ${toolName}`);
      }

      try {
        const result = await tool.handler(toolArgs);
        const text =
          typeof result === "string" ? result : JSON.stringify(result, null, 2);
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text }],
          },
        };
      } catch (err: any) {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: `Error: ${err.message ?? String(err)}`,
              },
            ],
            isError: true,
          },
        };
      }
    }

    default:
      return jsonRpcError(id, -32601, `Method not found: ${method}`);
  }
}

// ---------------------------------------------------------------------------
// TanStack Start API route
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/api/mcp/buffer")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = requireMcpAuth(request);
        if (unauthorized) return unauthorized;

        // Validate Content-Type
        const ct = request.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) {
          return new Response(
            JSON.stringify(
              jsonRpcError(null, -32700, "Content-Type must be application/json"),
            ),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // Parse body
        let body: RpcRequest;
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify(jsonRpcError(null, -32700, "Parse error")),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const result = await dispatch(body);

        // null result means no response (e.g., notifications/initialized)
        if (result === null) {
          return new Response(null, { status: 204 });
        }

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },

      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, x-api-key",
          },
        });
      },
    },
  },
});
