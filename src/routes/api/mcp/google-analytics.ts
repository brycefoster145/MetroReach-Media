/**
 * MCP (Model Context Protocol) route for the Google Analytics Data API v1beta.
 *
 * Implements JSON-RPC 2.0 over HTTP at POST /api/mcp/google-analytics.
 * Wraps the Analytics Admin API (properties) and Analytics Data API (reports).
 *
 * Integrated into the MetroReach Media TanStack Start site.
 *
 * Tools exposed:
 *   ga_list_properties — list GA4 properties under the authenticated account
 *   ga_get_property    — get full details for a single GA4 property
 *   ga_run_report      — run a standard Analytics report (dimensions, metrics, date ranges)
 *   ga_get_realtime    — run a realtime Analytics report
 */

import { createFileRoute } from "@tanstack/react-router";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ANALYTICS_ADMIN_BASE = "https://analyticsadmin.googleapis.com/v1beta";
const ANALYTICS_DATA_BASE = "https://analyticsdata.googleapis.com/v1beta";
const ACCESS_TOKEN = process.env.GOOGLE_ANALYTICS_ACCESS_TOKEN ?? "";
const SERVER_NAME = "mcp-google-analytics";
const SERVER_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// REST request helpers
// ---------------------------------------------------------------------------

interface GoogleApiError {
  error?: {
    code: number;
    message: string;
    status: string;
    details?: unknown[];
  };
}

/**
 * Send a REST request to a Google API.
 * Automatically sets the Authorization header with the Bearer token.
 * Returns the parsed JSON response body on success.
 */
async function googleApiRequest<T = unknown>(
  baseUrl: string,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  if (!ACCESS_TOKEN) {
    throw new Error(
      "GOOGLE_ANALYTICS_ACCESS_TOKEN environment variable is not set",
    );
  }

  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${ACCESS_TOKEN}`,
    Accept: "application/json",
  };

  const fetchOpts: RequestInit = { method, headers };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    fetchOpts.body = JSON.stringify(body);
  }

  const res = await fetch(url, fetchOpts);

  // Handle non-JSON responses (e.g. empty 204)
  const text = await res.text();
  let json: T & GoogleApiError;
  try {
    json = text ? JSON.parse(text) : ({} as T & GoogleApiError);
  } catch {
    throw new Error(
      `Google Analytics API returned non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`,
    );
  }

  if (!res.ok || json.error) {
    const errMsg = json.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Google Analytics API error: ${errMsg}`);
  }

  return json;
}

/** Convenience: Admin API request. */
async function adminRequest<T = unknown>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  return googleApiRequest<T>(ANALYTICS_ADMIN_BASE, method, path, body);
}

/** Convenience: Data API request. */
async function dataRequest<T = unknown>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  return googleApiRequest<T>(ANALYTICS_DATA_BASE, method, path, body);
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

interface GA4Property {
  name: string;          // "properties/123456789"
  displayName: string;
  propertyType: string;
  parent: string;        // "accounts/123456789"
  createTime: string;
  updateTime: string;
  timeZone: string;
  currencyCode: string;
  industryCategory: string;
}

interface ListPropertiesResponse {
  properties?: GA4Property[];
  nextPageToken?: string;
}

async function listProperties(): Promise<ListPropertiesResponse> {
  const data = await adminRequest<ListPropertiesResponse>(
    "GET",
    "/properties",
  );
  return data;
}

async function getProperty(args: {
  property_id: string;
}): Promise<GA4Property> {
  const data = await adminRequest<GA4Property>(
    "GET",
    `/${args.property_id}`,
  );
  return data;
}

interface RunReportArgs {
  property_id: string;
  dimensions?: string[];
  metrics?: string[];
  start_date?: string;    // "YYYY-MM-DD" or "30daysAgo", etc.
  end_date?: string;      // "YYYY-MM-DD" or "today", etc.
  limit?: number;         // row count (default 100)
}

async function runReport(args: RunReportArgs): Promise<unknown> {
  const propertyId = args.property_id;
  const dimensions = (args.dimensions ?? ["city"]).map((name) => ({ name }));
  const metrics = (args.metrics ?? ["activeUsers"]).map((name) => ({ name }));
  const startDate = args.start_date ?? "30daysAgo";
  const endDate = args.end_date ?? "today";
  const limit = args.limit ?? 100;

  const requestBody = {
    dimensions,
    metrics,
    dateRanges: [{ startDate, endDate }],
    limit,
  };

  const data = await dataRequest<unknown>(
    "POST",
    `/properties/${propertyId}:runReport`,
    requestBody,
  );
  return data;
}

interface RunRealtimeArgs {
  property_id: string;
  dimensions?: string[];
  metrics?: string[];
  limit?: number; // row count (default 100)
}

async function runRealtime(args: RunRealtimeArgs): Promise<unknown> {
  const propertyId = args.property_id;
  const dimensions = (args.dimensions ?? ["city"]).map((name) => ({ name }));
  const metrics = (args.metrics ?? ["activeUsers"]).map((name) => ({ name }));
  const limit = args.limit ?? 100;

  const requestBody = {
    dimensions,
    metrics,
    limit,
  };

  const data = await dataRequest<unknown>(
    "POST",
    `/properties/${propertyId}:runRealtimeReport`,
    requestBody,
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
    name: "ga_list_properties",
    description:
      "List all GA4 properties accessible by the authenticated Google account. " +
      "Returns property resource names, display names, types, time zones, " +
      "currency codes, and industry categories. " +
      "Use this to discover available properties before running reports.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    handler: listProperties,
  },
  {
    name: "ga_get_property",
    description:
      "Get full details for a single GA4 property by its resource name. " +
      "The property_id should be in the format 'properties/123456789'. " +
      "Returns display name, type, parent account, time zone, currency, " +
      "industry category, and creation/update timestamps.",
    inputSchema: {
      type: "object",
      properties: {
        property_id: {
          type: "string",
          description:
            "The GA4 property resource name (e.g., 'properties/123456789'). Obtain from ga_list_properties.",
        },
      },
      required: ["property_id"],
    },
    handler: getProperty,
  },
  {
    name: "ga_run_report",
    description:
      "Run a standard Google Analytics report against a GA4 property. " +
      "Provide property_id, optional arrays of dimension names and metric names, " +
      "optional start_date/end_date (YYYY-MM-DD or relative like '30daysAgo'), " +
      "and optional row limit (default 100). " +
      "Returns dimension/metric rows from the Analytics Data API runReport endpoint.",
    inputSchema: {
      type: "object",
      properties: {
        property_id: {
          type: "string",
          description:
            "The GA4 property resource name (e.g., 'properties/123456789'). Obtain from ga_list_properties.",
        },
        dimensions: {
          type: "array",
          items: { type: "string" },
          description:
            "Array of dimension names (e.g., ['city', 'deviceCategory', 'country']). Defaults to ['city'].",
        },
        metrics: {
          type: "array",
          items: { type: "string" },
          description:
            "Array of metric names (e.g., ['activeUsers', 'sessions', 'bounceRate']). Defaults to ['activeUsers'].",
        },
        start_date: {
          type: "string",
          description:
            "Start date for the report. Use YYYY-MM-DD or relative (e.g., '30daysAgo'). Defaults to '30daysAgo'.",
        },
        end_date: {
          type: "string",
          description:
            "End date for the report. Use YYYY-MM-DD or relative (e.g., 'today'). Defaults to 'today'.",
        },
        limit: {
          type: "number",
          description:
            "Maximum number of rows to return. Defaults to 100.",
        },
      },
      required: ["property_id"],
    },
    handler: runReport,
  },
  {
    name: "ga_get_realtime",
    description:
      "Run a realtime Google Analytics report against a GA4 property. " +
      "Returns current active users and other realtime metrics across dimensions. " +
      "Provide property_id, optional dimensions and metrics arrays, " +
      "and optional row limit (default 100).",
    inputSchema: {
      type: "object",
      properties: {
        property_id: {
          type: "string",
          description:
            "The GA4 property resource name (e.g., 'properties/123456789'). Obtain from ga_list_properties.",
        },
        dimensions: {
          type: "array",
          items: { type: "string" },
          description:
            "Array of dimension names (e.g., ['city', 'deviceCategory']). Defaults to ['city'].",
        },
        metrics: {
          type: "array",
          items: { type: "string" },
          description:
            "Array of metric names (e.g., ['activeUsers', 'screenPageViews']). Defaults to ['activeUsers'].",
        },
        limit: {
          type: "number",
          description:
            "Maximum number of rows to return. Defaults to 100.",
        },
      },
      required: ["property_id"],
    },
    handler: runRealtime,
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

export const Route = createFileRoute("/api/mcp/google-analytics")({
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
