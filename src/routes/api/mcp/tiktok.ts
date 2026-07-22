/**
 * MCP (Model Context Protocol) route for the TikTok Business API v1.3.
 *
 * Implements JSON-RPC 2.0 over HTTP at POST /api/mcp/tiktok.
 * Wraps the TikTok Business API (https://business-api.tiktok.com/open_api/v1.3).
 *
 * Integrated into the MetroReach Media TanStack Start site.
 *
 * Tools exposed:
 *   tiktok_list_advertisers      — list accessible advertiser accounts
 *   tiktok_list_campaigns         — list campaigns for an advertiser
 *   tiktok_get_campaign_reports   — get integrated campaign reports
 *   tiktok_list_ad_groups         — list ad groups for an advertiser
 */

import { createFileRoute } from "@tanstack/react-router";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TIKTOK_API_BASE = "https://business-api.tiktok.com/open_api/v1.3";
const ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN ?? "";
const SERVER_NAME = "mcp-tiktok";
const SERVER_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// TikTok Business API request helper
// ---------------------------------------------------------------------------

interface TikTokApiError {
  code: number;
  message: string;
  request_id?: string;
}

interface TikTokApiResponse<T = unknown> {
  code: number;
  message: string;
  request_id?: string;
  data?: T;
}

/**
 * Send a REST request to the TikTok Business API v1.3.
 * Sets the Access-Token header on every request (TikTok auth pattern).
 * Returns the data field on success, throws on API-level errors.
 */
async function tiktokApiRequest<T = unknown>(
  method: "GET" | "POST",
  path: string,
  queryParams?: Record<string, string>,
  body?: unknown,
): Promise<T> {
  if (!ACCESS_TOKEN) {
    throw new Error("TIKTOK_ACCESS_TOKEN environment variable is not set");
  }

  const url = new URL(`${TIKTOK_API_BASE}${path}`);

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    "Access-Token": ACCESS_TOKEN,
    "Accept": "application/json",
  };

  const fetchOpts: RequestInit = { method, headers };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    fetchOpts.body = JSON.stringify(body);
  }

  const res = await fetch(url.toString(), fetchOpts);

  // TikTok often returns non-JSON on auth failures
  const text = await res.text();
  let json: TikTokApiResponse<T>;
  try {
    json = text ? JSON.parse(text) : ({} as TikTokApiResponse<T>);
  } catch {
    throw new Error(
      `TikTok Business API returned non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`,
    );
  }

  // TikTok API uses a code field: 0 = success, anything else is an error
  if (json.code !== 0) {
    throw new Error(
      `TikTok Business API error (code ${json.code}): ${json.message}` +
        (json.request_id ? ` [request_id: ${json.request_id}]` : ""),
    );
  }

  return (json.data ?? {}) as T;
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

interface TikTokAdvertiser {
  advertiser_id: string;
  advertiser_name: string;
  status: string;
  currency: string;
  timezone: string;
  industry: string;
}

async function listAdvertisers(): Promise<{ advertisers: TikTokAdvertiser[] }> {
  const data = await tiktokApiRequest<{
    list?: TikTokAdvertiser[];
  }>("GET", "/advertiser/info/");
  return { advertisers: data.list ?? [] };
}

interface TikTokCampaign {
  campaign_id: string;
  campaign_name: string;
  status: string;
  objective_type: string;
  budget: number;
  budget_mode: string;
  create_time: string;
}

async function listCampaigns(args: {
  advertiser_id: string;
}): Promise<{ campaigns: TikTokCampaign[] }> {
  const data = await tiktokApiRequest<{
    list?: TikTokCampaign[];
  }>("GET", "/campaign/get/", { advertiser_id: args.advertiser_id });
  return { campaigns: data.list ?? [] };
}

interface TikTokCampaignReport {
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  spend: number;
  cpm: number;
  ctr: number;
  cpc: number;
  conversions: number;
  cost_per_conversion: number;
}

async function getCampaignReports(args: {
  advertiser_id: string;
  dimensions?: string[];
  metrics?: string[];
  start_date?: string;
  end_date?: string;
}): Promise<{ reports: TikTokCampaignReport[] }> {
  const dimensions = args.dimensions ?? ["campaign_id"];
  const metrics = args.metrics ?? [
    "impressions",
    "clicks",
    "spend",
    "cpm",
    "ctr",
    "cpc",
    "conversions",
    "cost_per_conversion",
  ];

  // TikTok report/integrated/get uses query params for all report config
  const params: Record<string, string> = {
    advertiser_id: args.advertiser_id,
    report_type: "BASIC",
    data_level: "AUCTION_CAMPAIGN",
    dimensions: JSON.stringify(dimensions),
    metrics: JSON.stringify(metrics),
    start_date: args.start_date ?? "30",
    end_date: args.end_date ?? "1",
  };

  const data = await tiktokApiRequest<{
    list?: TikTokCampaignReport[];
  }>("GET", "/report/integrated/get/", params);
  return { reports: data.list ?? [] };
}

interface TikTokAdGroup {
  adgroup_id: string;
  adgroup_name: string;
  campaign_id: string;
  status: string;
  optimization_goal: string;
  budget: number;
  budget_mode: string;
  schedule_start_time: string;
  schedule_end_time: string;
}

async function listAdGroups(args: {
  advertiser_id: string;
  campaign_id?: string;
}): Promise<{ ad_groups: TikTokAdGroup[] }> {
  const params: Record<string, string> = {
    advertiser_id: args.advertiser_id,
  };

  if (args.campaign_id) {
    params.campaign_id = args.campaign_id;
  }

  const data = await tiktokApiRequest<{
    list?: TikTokAdGroup[];
  }>("GET", "/adgroup/get/", params);
  return { ad_groups: data.list ?? [] };
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
    name: "tiktok_list_advertisers",
    description:
      "List all TikTok advertiser accounts accessible with the configured access token. " +
      "Returns advertiser IDs, names, statuses, currencies, timezones, and industries. " +
      "Use this to discover available advertiser accounts before querying campaigns.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    handler: listAdvertisers,
  },
  {
    name: "tiktok_list_campaigns",
    description:
      "List all campaigns for a given TikTok advertiser account. " +
      "Returns campaign IDs, names, statuses, objective types, budgets, and creation times. " +
      "Requires an advertiser_id (obtained from tiktok_list_advertisers).",
    inputSchema: {
      type: "object",
      properties: {
        advertiser_id: {
          type: "string",
          description:
            "The TikTok advertiser ID. Obtain from tiktok_list_advertisers.",
        },
      },
      required: ["advertiser_id"],
    },
    handler: listCampaigns,
  },
  {
    name: "tiktok_get_campaign_reports",
    description:
      "Get integrated campaign performance reports from TikTok Ads. " +
      "Requires advertiser_id. Accepts optional dimensions, metrics, start_date, " +
      "and end_date. Defaults to last 30 days with campaign-level metrics including " +
      "impressions, clicks, spend, CPM, CTR, CPC, conversions, and cost_per_conversion. " +
      "Dates are relative days (e.g., start_date: '30', end_date: '1' for last 30 days).",
    inputSchema: {
      type: "object",
      properties: {
        advertiser_id: {
          type: "string",
          description:
            "The TikTok advertiser ID. Obtain from tiktok_list_advertisers.",
        },
        dimensions: {
          type: "array",
          items: { type: "string" },
          description:
            "Array of dimension names (e.g., ['campaign_id', 'adgroup_id']). Defaults to ['campaign_id'].",
        },
        metrics: {
          type: "array",
          items: { type: "string" },
          description:
            "Array of metric names (e.g., ['impressions', 'clicks', 'spend', 'cpm', 'ctr', 'cpc', 'conversions', 'cost_per_conversion']). Defaults to all standard metrics.",
        },
        start_date: {
          type: "string",
          description:
            "Start date as relative days (e.g., '30' for 30 days ago). Defaults to '30'.",
        },
        end_date: {
          type: "string",
          description:
            "End date as relative days (e.g., '1' for 1 day ago). Defaults to '1'.",
        },
      },
      required: ["advertiser_id"],
    },
    handler: getCampaignReports,
  },
  {
    name: "tiktok_list_ad_groups",
    description:
      "List ad groups for a TikTok advertiser account. " +
      "Optionally filter by campaign_id to get ad groups for a specific campaign. " +
      "Returns ad group IDs, names, statuses, optimization goals, budgets, " +
      "and schedule info. Requires advertiser_id.",
    inputSchema: {
      type: "object",
      properties: {
        advertiser_id: {
          type: "string",
          description:
            "The TikTok advertiser ID. Obtain from tiktok_list_advertisers.",
        },
        campaign_id: {
          type: "string",
          description:
            "Optional. Filter ad groups to only those belonging to this campaign ID.",
        },
      },
      required: ["advertiser_id"],
    },
    handler: listAdGroups,
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

export const Route = createFileRoute("/api/mcp/tiktok")({
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
