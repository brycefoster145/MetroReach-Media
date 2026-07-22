/**
 * MCP (Model Context Protocol) route for the Notion API.
 *
 * Implements JSON-RPC 2.0 over HTTP at POST /api/mcp/notion.
 * Wraps the Notion REST API v1 (https://api.notion.com/v1).
 *
 * Integrated into the MetroReach Media TanStack Start site.
 *
 * Tools exposed:
 *   notion_search          — search all pages/databases accessible to the integration
 *   notion_get_page        — retrieve a page by ID
 *   notion_get_database    — retrieve a database by ID
 *   notion_query_database  — query a database with optional filter/sort
 */

import { createFileRoute } from "@tanstack/react-router";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_TOKEN = process.env.NOTION_API_KEY ?? "";
const NOTION_VERSION = "2022-06-28";
const SERVER_NAME = "mcp-notion";
const SERVER_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// Notion REST API request helper
// ---------------------------------------------------------------------------

interface NotionApiError {
  object: "error";
  status: number;
  code: string;
  message: string;
}

/**
 * Send a REST request to the Notion API v1.
 * Sets the Authorization: Bearer header and Notion-Version header on every request.
 * Returns the parsed JSON response body on success.
 */
async function notionApiRequest<T = unknown>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
): Promise<T> {
  if (!NOTION_TOKEN) {
    throw new Error("NOTION_API_KEY environment variable is not set");
  }

  const url = `${NOTION_API_BASE}${path}`;

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${NOTION_TOKEN}`,
    "Notion-Version": NOTION_VERSION,
    "Accept": "application/json",
  };

  const fetchOpts: RequestInit = { method, headers };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    fetchOpts.body = JSON.stringify(body);
  }

  const res = await fetch(url, fetchOpts);

  // Handle non-JSON responses
  const text = await res.text();
  let json: T & NotionApiError;
  try {
    json = text ? JSON.parse(text) : ({} as T & NotionApiError);
  } catch {
    throw new Error(
      `Notion API returned non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`,
    );
  }

  if (!res.ok) {
    const errMsg = (json as NotionApiError).message ?? `HTTP ${res.status}`;
    const errCode = (json as NotionApiError).code ?? "unknown";
    throw new Error(`Notion API error (${errCode}): ${errMsg}`);
  }

  return json;
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

interface NotionSearchResult {
  object: string;
  id: string;
  [key: string]: unknown;
}

interface NotionSearchResponse {
  object: "list";
  results: NotionSearchResult[];
  next_cursor: string | null;
  has_more: boolean;
}

async function search(args: {
  query?: string;
  filter?: { property: string; value: string };
  sort?: { direction: "ascending" | "descending"; timestamp: "last_edited_time" };
  start_cursor?: string;
  page_size?: number;
}): Promise<NotionSearchResponse> {
  const body: Record<string, unknown> = {};

  if (args.query) body.query = args.query;
  if (args.filter) body.filter = args.filter;
  if (args.sort) body.sort = args.sort;
  if (args.start_cursor) body.start_cursor = args.start_cursor;
  if (args.page_size) body.page_size = args.page_size;

  return notionApiRequest<NotionSearchResponse>("POST", "/search", body);
}

async function getPage(args: {
  page_id: string;
}): Promise<unknown> {
  return notionApiRequest("GET", `/pages/${args.page_id}`);
}

async function getDatabase(args: {
  database_id: string;
}): Promise<unknown> {
  return notionApiRequest("GET", `/databases/${args.database_id}`);
}

interface NotionDatabaseQueryArgs {
  database_id: string;
  filter?: Record<string, unknown>;
  sorts?: Array<{
    property?: string;
    timestamp?: string;
    direction: "ascending" | "descending";
  }>;
  start_cursor?: string;
  page_size?: number;
}

async function queryDatabase(args: NotionDatabaseQueryArgs): Promise<unknown> {
  const body: Record<string, unknown> = {};

  if (args.filter) body.filter = args.filter;
  if (args.sorts) body.sorts = args.sorts;
  if (args.start_cursor) body.start_cursor = args.start_cursor;
  if (args.page_size) body.page_size = args.page_size;

  return notionApiRequest("POST", `/databases/${args.database_id}/query`, body);
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
    name: "notion_search",
    description:
      "Search all pages and databases accessible to the Notion integration. " +
      "Accepts an optional text query for full-text search, an optional filter " +
      "to limit results to pages or databases only, optional sort direction, " +
      "and pagination controls (start_cursor, page_size). " +
      "Returns matching pages and databases with their IDs, titles, and properties. " +
      "Use this as the entry point to discover available content.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Optional text to search for in page/database titles. Omit to return all accessible items.",
        },
        filter: {
          type: "object",
          properties: {
            property: {
              type: "string",
              enum: ["object"],
              description: "The property to filter on (always 'object').",
            },
            value: {
              type: "string",
              enum: ["page", "database"],
              description:
                "Filter to only return 'page' or 'database' results.",
            },
          },
          description:
            "Optional filter to limit results to only pages or only databases.",
        },
        sort: {
          type: "object",
          properties: {
            direction: {
              type: "string",
              enum: ["ascending", "descending"],
              description: "Sort direction.",
            },
            timestamp: {
              type: "string",
              enum: ["last_edited_time"],
              description: "Timestamp field to sort by.",
            },
          },
          description:
            "Optional sort configuration. Sorts by last_edited_time.",
        },
        start_cursor: {
          type: "string",
          description:
            "Pagination cursor returned from a previous search response (next_cursor). Use to fetch the next page of results.",
        },
        page_size: {
          type: "number",
          description:
            "Maximum number of results to return per page. Defaults to the Notion API default.",
        },
      },
    },
    handler: search,
  },
  {
    name: "notion_get_page",
    description:
      "Retrieve a Notion page by its ID. " +
      "Returns the full page object including all properties, block children, " +
      "and metadata (created_time, last_edited_time, archived status). " +
      "The page_id is a UUID (with or without hyphens) obtained from notion_search.",
    inputSchema: {
      type: "object",
      properties: {
        page_id: {
          type: "string",
          description:
            "The Notion page ID (UUID, with or without hyphens). Obtain from notion_search or from a Notion URL.",
        },
      },
      required: ["page_id"],
    },
    handler: getPage,
  },
  {
    name: "notion_get_database",
    description:
      "Retrieve a Notion database by its ID. " +
      "Returns the full database object including title, properties schema, " +
      "and metadata (created_time, last_edited_time). " +
      "Does not return the rows/pages within the database — use notion_query_database for that. " +
      "The database_id is a UUID obtained from notion_search.",
    inputSchema: {
      type: "object",
      properties: {
        database_id: {
          type: "string",
          description:
            "The Notion database ID (UUID, with or without hyphens). Obtain from notion_search or from a Notion URL.",
        },
      },
      required: ["database_id"],
    },
    handler: getDatabase,
  },
  {
    name: "notion_query_database",
    description:
      "Query a Notion database to retrieve its pages/rows. " +
      "Supports optional filter conditions (property-based filters following " +
      "the Notion API filter syntax), optional sort specifications " +
      "(by property or timestamp, ascending or descending), " +
      "and pagination (start_cursor, page_size). " +
      "Requires a database_id. Returns a paginated list of page objects.",
    inputSchema: {
      type: "object",
      properties: {
        database_id: {
          type: "string",
          description:
            "The Notion database ID (UUID, with or without hyphens). Obtain from notion_search.",
        },
        filter: {
          type: "object",
          description:
            "Optional Notion API filter object. See Notion API docs for filter syntax " +
            "(supports and/or/nested compound filters and property condition filters).",
        },
        sorts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              property: {
                type: "string",
                description: "Property name to sort by.",
              },
              timestamp: {
                type: "string",
                enum: ["created_time", "last_edited_time"],
                description: "Timestamp field to sort by (alternative to property).",
              },
              direction: {
                type: "string",
                enum: ["ascending", "descending"],
                description: "Sort direction.",
              },
            },
          },
          description:
            "Optional array of sort specifications. Sort by property name or by timestamp. " +
            "Defaults to no specific ordering.",
        },
        start_cursor: {
          type: "string",
          description:
            "Pagination cursor from a previous query response. Use to fetch the next page of results.",
        },
        page_size: {
          type: "number",
          description:
            "Maximum number of database rows to return per page (max 100). Defaults to the Notion API default.",
        },
      },
      required: ["database_id"],
    },
    handler: queryDatabase,
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

export const Route = createFileRoute("/api/mcp/notion")({
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
