/**
 * MCP (Model Context Protocol) route for the Meta Ads API.
 *
 * Implements JSON-RPC 2.0 over HTTP at POST /api/mcp/meta.
 * Wraps the Facebook Graph API v21.0 for ad account and campaign management.
 *
 * Integrated into the MetroReach Media TanStack Start site.
 *
 * Tools exposed:
 *   meta_list_ad_accounts    — list accessible ad accounts
 *   meta_list_campaigns      — list campaigns for an ad account
 *   meta_get_campaign_insights — get performance insights for a campaign
 *   meta_create_campaign     — create a new campaign
 *   meta_list_ad_sets        — list ad sets for an ad account
 *   meta_create_ad_account   — create a new ad account under a Business Manager
 *   meta_list_owned_pages    — list pages owned by a Business Manager
 *   meta_get_page            — get page details (name, about, website, username, cover)
 *   meta_update_page         — update page fields (name, about, website, username)
 *   meta_update_page_cover   — upload and set a new cover photo for a page
 *   meta_update_page_picture — set a new profile picture for a page
 */

import { createFileRoute } from "@tanstack/react-router";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";
const META_TOKEN = process.env.META_ACCESS_TOKEN ?? "";
// The token is a PAGE token; /me endpoints resolve to the page.
// For ad account access we must query the user's ad accounts explicitly.
const META_USER_ID = process.env.META_USER_ID ?? "27853154407634636";
const SERVER_NAME = "mcp-meta";
const SERVER_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// Facebook Graph API request helper
// ---------------------------------------------------------------------------

interface GraphApiError {
  error?: {
    message: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/**
 * Make a request to the Facebook Graph API.
 * The access_token is appended as a query parameter (Facebook auth pattern).
 */
async function graphApiRequest<T = unknown>(
  method: "GET" | "POST",
  path: string,
  params?: Record<string, string>,
  body?: Record<string, unknown>,
): Promise<T> {
  const url = new URL(`${GRAPH_API_BASE}${path}`);
  url.searchParams.set("access_token", META_TOKEN);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const fetchOpts: RequestInit = {
    method,
    headers: {
      "Accept": "application/json",
    },
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

  // Check for Facebook Graph API-level errors
  const errJson = json as GraphApiError;
  if (errJson.error) {
    throw new Error(
      `Facebook Graph API error: ${errJson.error.message}` +
        (errJson.error.code ? ` (code ${errJson.error.code})` : ""),
    );
  }

  return json as T;
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function listAdAccounts() {
  // Use explicit user ID instead of /me because the token is a PAGE token.
  // /me/adaccounts on a page token tries to find "adaccounts" field on a Page
  // object, which doesn't exist — causing "(#100) Tried accessing nonexisting field".
  const data = await graphApiRequest<{
    data?: Array<{
      id: string;
      name: string;
      account_status: number;
      currency: string;
    }>;
  }>("GET", `/${META_USER_ID}/adaccounts`, {
    fields: "id,name,account_status,currency",
  });
  return data;
}

async function listCampaigns(args: { ad_account_id: string }) {
  const data = await graphApiRequest<{
    data?: Array<{
      id: string;
      name: string;
      status: string;
      objective: string;
      daily_budget: number;
      lifetime_budget: number;
    }>;
  }>("GET", `/${args.ad_account_id}/campaigns`, {
    fields: "id,name,status,objective,daily_budget,lifetime_budget",
  });
  return data;
}

async function getCampaignInsights(args: { campaign_id: string }) {
  const data = await graphApiRequest<{
    data?: Array<{
      impressions: string;
      clicks: string;
      spend: string;
      cpm: string;
      ctr: string;
      cpc: string;
      reach: string;
      date_start: string;
      date_stop: string;
    }>;
  }>("GET", `/${args.campaign_id}/insights`, {
    date_preset: "last_30d",
    fields: "impressions,clicks,spend,cpm,ctr,cpc,reach",
  });
  return data;
}

async function createCampaign(args: {
  ad_account_id: string;
  name: string;
  objective: string;
  status: string;
  special_ad_categories?: string[];
}) {
  const body: Record<string, unknown> = {
    name: args.name,
    objective: args.objective,
    status: args.status,
    special_ad_categories: args.special_ad_categories ?? [],
  };

  const data = await graphApiRequest<{
    id?: string;
  }>(
    "POST",
    `/${args.ad_account_id}/campaigns`,
    undefined,
    body,
  );
  return data;
}

async function listAdSets(args: { ad_account_id: string }) {
  const data = await graphApiRequest<{
    data?: Array<{
      id: string;
      name: string;
      status: string;
      daily_budget: number;
      optimization_goal: string;
    }>;
  }>("GET", `/${args.ad_account_id}/adsets`, {
    fields: "id,name,status,daily_budget,optimization_goal",
  });
  return data;
}

async function createAdAccount(args: {
  business_id: string;
  name: string;
  currency?: string;
  timezone_id: number;
  end_advertiser: string;
  media_agency: string;
  partner: string;
}) {
  const body: Record<string, unknown> = {
    name: args.name,
    currency: args.currency ?? "USD",
    timezone_id: args.timezone_id,
    end_advertiser: args.end_advertiser,
    media_agency: args.media_agency,
    partner: args.partner,
  };

  const data = await graphApiRequest<{
    id?: string;
  }>(
    "POST",
    `/${args.business_id}/adaccount`,
    undefined,
    body,
  );
  return data;
}

// ---------------------------------------------------------------------------
// Page management tools
// ---------------------------------------------------------------------------

async function listOwnedPages(args: { business_id: string }) {
  const data = await graphApiRequest<{
    data?: Array<{
      id: string;
      name: string;
      access_token: string;
      category: string;
    }>;
  }>("GET", `/${args.business_id}/owned_pages`, {
    fields: "id,name,access_token,category",
  });
  return data;
}

async function getPage(args: { page_id: string }) {
  const data = await graphApiRequest<{
    id: string;
    name: string;
    about?: string;
    website?: string;
    username?: string;
    cover?: {
      id: string;
      source: string;
    };
    picture?: {
      data: { url: string };
    };
    link?: string;
  }>("GET", `/${args.page_id}`, {
    fields: "id,name,about,website,username,cover,picture,link",
  });
  return data;
}

async function updatePage(args: {
  page_id: string;
  name?: string;
  about?: string;
  website?: string;
  username?: string;
}) {
  const body: Record<string, unknown> = {};
  if (args.name) body.name = args.name;
  if (args.about) body.about = args.about;
  if (args.website) body.website = args.website;
  if (args.username) body.username = args.username;

  const data = await graphApiRequest<{ success?: boolean }>(
    "POST",
    `/${args.page_id}`,
    undefined,
    body,
  );
  return data;
}

async function updatePageCover(args: { page_id: string; photo_url: string }) {
  // Step 1: Upload the photo to the page
  const photoUpload = await graphApiRequest<{ id: string; post_id?: string }>(
    "POST",
    `/${args.page_id}/photos`,
    undefined,
    {
      url: args.photo_url,
      published: false,
    },
  );

  if (!photoUpload.id) {
    throw new Error("Failed to upload cover photo — no photo ID returned");
  }

  // Step 2: Set the uploaded photo as the cover
  const result = await graphApiRequest<{ success?: boolean }>(
    "POST",
    `/${args.page_id}`,
    undefined,
    {
      cover: photoUpload.id,
    },
  );

  return { photo_id: photoUpload.id, result };
}

async function updatePagePicture(args: { page_id: string; picture_url: string }) {
  const data = await graphApiRequest<{ success?: boolean }>(
    "POST",
    `/${args.page_id}/picture`,
    undefined,
    {
      url: args.picture_url,
    },
  );
  return data;
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
    name: "meta_list_ad_accounts",
    description:
      "List all ad accounts accessible by the authenticated Meta user. " +
      "Returns account IDs, names, status codes, and currencies. " +
      "Use this to discover which ad accounts are available before querying campaigns or ad sets.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    handler: listAdAccounts,
  },
  {
    name: "meta_list_campaigns",
    description:
      "List all campaigns for a given ad account. " +
      "Returns campaign IDs, names, statuses, objectives, and budget info. " +
      "Requires an ad_account_id (format: act_XXXXXXXXX).",
    inputSchema: {
      type: "object",
      properties: {
        ad_account_id: {
          type: "string",
          description:
            "The Meta ad account ID (e.g., act_123456789). Obtain from meta_list_ad_accounts.",
        },
      },
      required: ["ad_account_id"],
    },
    handler: listCampaigns,
  },
  {
    name: "meta_get_campaign_insights",
    description:
      "Get performance insights for a specific campaign over the last 30 days. " +
      "Returns impressions, clicks, spend, CPM, CTR, CPC, and reach. " +
      "Requires a campaign_id.",
    inputSchema: {
      type: "object",
      properties: {
        campaign_id: {
          type: "string",
          description:
            "The Meta campaign ID (numeric string). Obtain from meta_list_campaigns.",
        },
      },
      required: ["campaign_id"],
    },
    handler: getCampaignInsights,
  },
  {
    name: "meta_create_campaign",
    description:
      "Create a new Meta ad campaign in the specified ad account. " +
      "Provide name, objective (e.g., OUTCOME_LEADS, OUTCOME_TRAFFIC), " +
      "status (e.g., PAUSED, ACTIVE), and optional special_ad_categories. " +
      "Returns the new campaign ID on success.",
    inputSchema: {
      type: "object",
      properties: {
        ad_account_id: {
          type: "string",
          description:
            "The Meta ad account ID (e.g., act_123456789).",
        },
        name: {
          type: "string",
          description: "The campaign name.",
        },
        objective: {
          type: "string",
          description:
            "Campaign objective (e.g., OUTCOME_LEADS, OUTCOME_TRAFFIC, OUTCOME_ENGAGEMENT).",
        },
        status: {
          type: "string",
          description:
            "Campaign status. Typically PAUSED to start, then switch to ACTIVE.",
        },
        special_ad_categories: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional array of special ad category enums (e.g., ['CREDIT', 'EMPLOYMENT']).",
        },
      },
      required: ["ad_account_id", "name", "objective", "status"],
    },
    handler: createCampaign,
  },
  {
    name: "meta_list_ad_sets",
    description:
      "List all ad sets for a given ad account. " +
      "Returns ad set IDs, names, statuses, daily budgets, and optimization goals. " +
      "Requires an ad_account_id.",
    inputSchema: {
      type: "object",
      properties: {
        ad_account_id: {
          type: "string",
          description:
            "The Meta ad account ID (e.g., act_123456789). Obtain from meta_list_ad_accounts.",
        },
      },
      required: ["ad_account_id"],
    },
    handler: listAdSets,
  },
  {
    name: "meta_create_ad_account",
    description:
      "Create a new ad account under a Facebook Business Manager. " +
      "Provide the business_id, ad account name, currency, timezone_id, " +
      "end_advertiser (Facebook Page ID, App ID, or 'NONE'), " +
      "media_agency (Facebook Page ID of the managing agency, or 'NONE'), and " +
      "partner (Facebook Page ID, App ID, or 'NONE'). " +
      "Common timezone IDs: 1=Pacific, 7=Mountain, 13=Central, 43=Eastern, 78=Toronto. " +
      "Returns the new ad account ID on success.",
    inputSchema: {
      type: "object",
      properties: {
        business_id: {
          type: "string",
          description: "Facebook Business Manager ID (numeric string).",
        },
        name: {
          type: "string",
          description: "Ad account name (e.g., 'MetroReach Agency').",
        },
        currency: {
          type: "string",
          description: "ISO 4217 currency code. Default: USD.",
        },
        timezone_id: {
          type: "integer",
          description:
            "Timezone ID. Common: 1=Pacific, 7=Mountain, 13=Central, 43=Eastern, 78=Toronto.",
        },
        end_advertiser: {
          type: "string",
          description:
            "Facebook Page ID, App ID, or 'NONE' for the end advertiser (the entity that will own/run the ad account).",
        },
        media_agency: {
          type: "string",
          description:
            "Facebook Page ID of the managing media agency, or 'NONE' if not applicable.",
        },
        partner: {
          type: "string",
          description:
            "Facebook Page ID, App ID, or 'NONE' for the partner.",
        },
      },
      required: ["business_id", "name", "timezone_id", "end_advertiser", "media_agency", "partner"],
    },
    handler: createAdAccount,
  },
  {
    name: "meta_list_owned_pages",
    description:
      "List all Facebook Pages owned by a Business Manager. " +
      "Returns page IDs, names, categories, and access tokens. " +
      "Requires a business_id (e.g., 1892194778251520).",
    inputSchema: {
      type: "object",
      properties: {
        business_id: {
          type: "string",
          description: "Facebook Business Manager ID (numeric string).",
        },
      },
      required: ["business_id"],
    },
    handler: listOwnedPages,
  },
  {
    name: "meta_get_page",
    description:
      "Get details for a specific Facebook Page. " +
      "Returns name, about section, website, username, cover photo URL, profile picture URL, and page link. " +
      "Requires a page_id.",
    inputSchema: {
      type: "object",
      properties: {
        page_id: {
          type: "string",
          description: "Facebook Page ID (numeric string).",
        },
      },
      required: ["page_id"],
    },
    handler: getPage,
  },
  {
    name: "meta_update_page",
    description:
      "Update a Facebook Page's basic information. " +
      "Can update name, about (bio/description), website link, and username/handle. " +
      "All fields are optional — only provided fields will be updated. " +
      "Requires a page_id. Returns success confirmation.",
    inputSchema: {
      type: "object",
      properties: {
        page_id: {
          type: "string",
          description: "Facebook Page ID (numeric string).",
        },
        name: {
          type: "string",
          description: "New page name (optional).",
        },
        about: {
          type: "string",
          description: "New about/bio text (optional).",
        },
        website: {
          type: "string",
          description: "New website URL (optional).",
        },
        username: {
          type: "string",
          description: "New username/handle without @ (optional).",
        },
      },
      required: ["page_id"],
    },
    handler: updatePage,
  },
  {
    name: "meta_update_page_cover",
    description:
      "Upload and set a new cover photo for a Facebook Page. " +
      "Provide a publicly accessible image URL and the page_id. " +
      "The image is uploaded then set as the cover in two steps. " +
      "Recommended dimensions: 820x312 pixels (851x315 also accepted).",
    inputSchema: {
      type: "object",
      properties: {
        page_id: {
          type: "string",
          description: "Facebook Page ID (numeric string).",
        },
        photo_url: {
          type: "string",
          description: "Publicly accessible URL of the cover image.",
        },
      },
      required: ["page_id", "photo_url"],
    },
    handler: updatePageCover,
  },
  {
    name: "meta_update_page_picture",
    description:
      "Set a new profile picture for a Facebook Page. " +
      "Provide a publicly accessible image URL and the page_id. " +
      "Recommended: square image, minimum 180x180 pixels.",
    inputSchema: {
      type: "object",
      properties: {
        page_id: {
          type: "string",
          description: "Facebook Page ID (numeric string).",
        },
        picture_url: {
          type: "string",
          description: "Publicly accessible URL of the profile picture image.",
        },
      },
      required: ["page_id", "picture_url"],
    },
    handler: updatePagePicture,
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

export const Route = createFileRoute("/api/mcp/meta")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      },
    },
  },
});
