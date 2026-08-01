import { requireApiKey } from "~/lib/env";

/** Require the admin key for internal MCP tooling. */
export function requireMcpAuth(request: Request): Response | null {
  return requireApiKey(request);
}
