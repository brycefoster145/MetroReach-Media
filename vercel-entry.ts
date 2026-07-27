// Vercel Build Output API function entry.
//
// The Build Output Node launcher invokes the default export as a classic Node
// `(req, res)` handler — NOT a web handler. TanStack Start emits a portable web
// fetch handler (dist/server/server.js), so we adapt: Node IncomingMessage → web
// Request, run the fetch handler, stream the web Response back onto ServerResponse.
// Node 22 has global Request/Response/Headers/ReadableStream.
//
// Bundled (with its deps + the SSR handler's dynamic ./assets chunks) into
// .vercel/output/functions/render.func/index.mjs by build-vercel.sh.
//
// ── Self-healing cron kicker ──
// Vercel Cron Jobs (vercel.json) are the PRIMARY scheduler trigger. But serverless
// cold starts and cron execution delays can cause missed windows. As a fallback,
// this module starts a keep-alive interval that fires every 62 seconds and kicks
// the cron route internally. While the function stays warm, this guarantees at
// least one scheduling pass per minute. When the function goes cold, the next
// request restarts the interval. Combined with Vercel's own cron, we get
// overlapping coverage — posts WILL go out.
//
// ── Cold-start guard ──
// On every deployment cold start, the cron kicker waits STARTUP_DELAY_MS before
// its first kick. This prevents burst-publishing that would otherwise fire
// immediately on deploy (the old 5-second delay was too short to let the scheduler
// stabilize).
import type { IncomingMessage, ServerResponse } from "node:http";

import handler from "./dist/server/server.js";

const fetchHandler = handler as {
  fetch: (request: Request) => Response | Promise<Response>;
};

// ── Security headers applied to every response ──

const SECURITY_HEADERS: Record<string, string> = {
  "content-security-policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.stripe.com https://api.sendgrid.com;",
  "strict-transport-security":
    "max-age=31536000; includeSubDomains",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

function applySecurityHeaders(res: ServerResponse): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(key, value);
  }
}

const toWebRequest = (req: IncomingMessage): Request => {
  const host = req.headers.host ?? "localhost";
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined) ?? "https";
  const url = `${proto}://${host}${req.url ?? "/"}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) for (const v of value) headers.append(key, v);
    else if (value != null) headers.set(key, value);
  }
  const method = req.method ?? "GET";
  const hasBody = method !== "GET" && method !== "HEAD";
  return new Request(url, {
    method,
    headers,
    ...(hasBody
      ? { body: req as unknown as ReadableStream, duplex: "half" }
      : {}),
  } as RequestInit);
};

// ── Self-healing cron kicker ──
// Kicks the cron route every 62 seconds as long as the function stays warm.
// This is a FALLBACK — Vercel Cron Jobs (vercel.json) are the primary trigger.
// The interval is 62 seconds (not 60) to avoid racing with Vercel's own cron.

const STARTUP_DELAY_MS = 60_000; // 60-second cold-start guard to prevent burst-publishing

let cronKickerInterval: ReturnType<typeof setInterval> | null = null;

function startCronKicker(): void {
  if (cronKickerInterval) return; // Already running

  console.log(
    `[cron-kicker] Starting self-healing cron kicker (every 62s, first kick in ${STARTUP_DELAY_MS / 1000}s)`,
  );

  // Fire once on startup after the cold-start guard delay
  setTimeout(() => {
    kickCron().catch((err) =>
      console.error("[cron-kicker] Initial kick failed:", err.message),
    );
  }, STARTUP_DELAY_MS);

  // Then every 62 seconds
  cronKickerInterval = setInterval(() => {
    kickCron().catch((err) =>
      console.error("[cron-kicker] Interval kick failed:", err.message),
    );
  }, 62_000);

  // Keep the event loop alive — unref would let Node exit between requests
  cronKickerInterval.unref();
}

async function kickCron(): Promise<void> {
  try {
    console.log("[cron-kicker] 🔄 Kicking cron scheduler...");
    const res = await fetchHandler.fetch(
      new Request("http://localhost/api/cron/post-scheduler", { method: "GET" }),
    );
    if (!res.ok) {
      console.error(
        `[cron-kicker] Cron kick returned ${res.status}: ${res.statusText}`,
      );
    } else {
      const body = await res.text();
      // Truncate log — full body is in the cron route's own logs
      console.log(
        `[cron-kicker] ✅ Cron kick OK (${res.status}) — ${body.substring(0, 200)}`,
      );
    }
  } catch (err: any) {
    console.error(`[cron-kicker] ❌ Kick error: ${err.message}`);
  }
}

// Start the kicker on module load
startCronKicker();

// ── Main handler ──

export default async function vercelHandler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const webRes = await fetchHandler.fetch(toWebRequest(req));
    res.statusCode = webRes.status;
    webRes.headers.forEach((value, key) => res.setHeader(key, value));
    applySecurityHeaders(res);
    if (webRes.body) {
      const reader = webRes.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (error) {
    // Log the detail server-side (captured by the host's function logs); never
    // return a stack trace to the public visitor of the site.
    console.error("[team-site] SSR request failed", error);
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain");
    applySecurityHeaders(res);
    res.end("Internal Server Error");
  }
}
