/**
 * MCP (Model Context Protocol) route for the Google Ads API.
 *
 * Implements JSON-RPC 2.0 over HTTP at POST /api/mcp/google-ads.
 * Wraps the Google Ads API v17 REST endpoints.
 *
 * Integrated into the MetroReach Media TanStack Start site.
 *
 * Tools exposed:
 *   googleads_list_customers          — list accessible Google Ads accounts
 *   googleads_list_campaigns          — list campaigns for a customer
 *   googleads_get_campaign_performance — performance metrics for campaigns
 *   googleads_list_ad_groups          — list ad groups for a customer
 */

import { createFileRoute } from "@tanstack/react-router";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GOOGLE_ADS_BASE = "https://googleads.googleapis.com/v17";
const ACCESS_TOKEN = process.env.GOOGLE_ADS_ACCESS_TOKEN ?? "";
const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "";
const SERVER_NAME = "mcp-google-ads";
const SERVER_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// REST request helper
// ---------------------------------------------------------------------------

interface GoogleAdsError {
  error?: {
    code: number;
    message: string;
    status: string;
    details?: unknown[];
  };
}

/**
 * Send a REST request to the Google Ads API.
 * Automatically appends the developer_token query param to every request.
 * Returns the parsed JSON response body on success.
 */
async function googleAdsRequest<T = unknown>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  if (!ACCESS_TOKEN) {
    throw new Error("GOOGLE_ADS_ACCESS_TOKEN environment variable is not set");
  }
  if (!DEVELOPER_TOKEN) {
    throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN environment variable is not set");
  }

  const url = new URL(`${GOOGLE_ADS_BASE}${path}`);
  url.searchParams.set("developer_token", DEVELOPER_TOKEN);

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${ACCESS_TOKEN}`,
    "Accept": "application/json",
  };

  const fetchOpts: RequestInit = { method, headers };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    fetchOpts.body = JSON.stringify(body);
  }

  const res = await fetch(url.toString(), fetchOpts);

  // Handle non-JSON responses (e.g. empty 204)
  const text = await res.text();
  let json: T & GoogleAdsError;
  try {
    json = text ? JSON.parse(text) : ({} as T & GoogleAdsError);
  } catch {
    throw new Error(
      `Google Ads API returned non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`,
    );
  }

  if (!res.ok || json.error) {
    const errMsg = json.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Google Ads API error: ${errMsg}`);
  }

  return json;
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

interface AccessibleCustomer {
  resourceName: string;
}

async function listCustomers(): Promise<{ customers: string[] }> {
  const data = await googleAdsRequest<{
    resourceNames?: string[];
  }>("GET", "/customers:listAccessibleCustomers");

  // Extract customer IDs from resource names like "customers/1234567890"
  const customers = (data.resourceNames ?? []).map((rn: string) => {
    const parts = rn.split("/");
    return parts[parts.length - 1] ?? rn;
  });

  return { customers };
}

interface Campaign {
  resourceName: string;
  id: string;
  name: string;
  status: string;
  advertisingChannelType: string;
  startDate: string;
  endDate: string;
}

async function listCampaigns(args: {
  customer_id: string;
}): Promise<{ campaigns: Campaign[] }> {
  const data = await googleAdsRequest<{
    results?: Array<{ campaign: Campaign }>;
  }>("GET", `/customers/${args.customer_id}/campaigns`);

  const campaigns = (data.results ?? []).map((r) => r.campaign);
  return { campaigns };
}

interface CampaignPerformance {
  campaign: {
    resourceName: string;
    id: string;
    name: string;
  };
  metrics: {
    impressions: string;
    clicks: string;
    costMicros: string;
    conversions: string;
  };
}

async function getCampaignPerformance(args: {
  customer_id: string;
  date_range?: "LAST_7_DAYS" | "LAST_30_DAYS" | "THIS_MONTH" | "LAST_MONTH";
}): Promise<{ results: CampaignPerformance[] }> {
  const dateRange = args.date_range ?? "LAST_30_DAYS";

  const query = `
    SELECT
      campaign.resource_name,
      campaign.id,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    WHERE segments.date DURING ${dateRange}
    ORDER BY metrics.impressions DESC
  `;

  const data = await googleAdsRequest<{
    results?: CampaignPerformance[];
  }>("POST", `/customers/${args.customer_id}/campaigns:search`, {
    query,
  });

  return { results: data.results ?? [] };
}

interface AdGroup {
  resourceName: string;
  id: string;
  name: string;
  status: string;
  type: string;
  campaign: string;
}

async function listAdGroups(args: {
  customer_id: string;
  campaign_id?: string;
}): Promise<{ adGroups: AdGroup[] }> {
  let path = `/customers/${args.customer_id}/adGroups`;

  const data = await googleAdsRequest<{
    results?: Array<{ adGroup: AdGroup }>;
  }>("GET", path);

  let adGroups = (data.results ?? []).map((r) => r.adGroup);

  // Client-side filter by campaign_id if provided
  if (args.campaign_id) {
    const campaignResource = `customers/${args.customer_id}/campaigns/${args.campaign_id}`;
    adGroups = adGroups.filter((ag) => ag.campaign === campaignResource);
  }

  return { adGroups };
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
    name: "googleads_list_customers",
    description:
      "List all Google Ads accounts accessible with the configured credentials. " +
      "Returns customer IDs that can be used with other googleads_* tools.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    handler: listCustomers,
  },
  {
    name: "googleads_list_campaigns",
    description:
      "List all campaigns for a given Google Ads customer account. " +
      "Provide the customer_id (from googleads_list_customers). " +
      "Returns campaign IDs, names, statuses, channel types, and date ranges.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: {
          type: "string",
          description:
            "The Google Ads customer ID (e.g., '1234567890'). Obtain from googleads_list_customers.",
        },
      },
      required: ["customer_id"],
    },
    handler: listCampaigns,
  },
  {
    name: "googleads_get_campaign_performance",
    description:
      "Get performance metrics for campaigns in a Google Ads account. " +
      "Runs a GAQL query returning impressions, clicks, cost, and conversions " +
      "for each campaign over the specified date range. " +
      "Supports LAST_7_DAYS, LAST_30_DAYS, THIS_MONTH, and LAST_MONTH. " +
      "Defaults to LAST_30_DAYS.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: {
          type: "string",
          description:
            "The Google Ads customer ID (e.g., '1234567890'). Obtain from googleads_list_customers.",
        },
        date_range: {
          type: "string",
          description:
            "Date range for metrics: LAST_7_DAYS, LAST_30_DAYS, THIS_MONTH, or LAST_MONTH. Defaults to LAST_30_DAYS.",
          enum: ["LAST_7_DAYS", "LAST_30_DAYS", "THIS_MONTH", "LAST_MONTH"],
        },
      },
      required: ["customer_id"],
    },
    handler: getCampaignPerformance,
  },
  {
    name: "googleads_list_ad_groups",
    description:
      "List ad groups for a Google Ads customer account. " +
      "Optionally filter by campaign_id to get ad groups for a specific campaign. " +
      "Returns ad group IDs, names, statuses, types, and parent campaign references.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: {
          type: "string",
          description:
            "The Google Ads customer ID (e.g., '1234567890'). Obtain from googleads_list_customers.",
        },
        campaign_id: {
          type: "string",
          description:
            "Optional. Filter ad groups to only those belonging to this campaign ID.",
        },
      },
      required: ["customer_id"],
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

export const Route = createFileRoute("/api/mcp/google-ads")({
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
