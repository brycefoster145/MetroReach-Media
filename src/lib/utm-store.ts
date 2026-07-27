/**
 * UTM Store Utility — src/lib/utm-store.ts
 * MetroReach Media
 *
 * Server-side and client-side UTM parameter capture.
 * Parses UTM params from request URLs and persists them in a `__utm` cookie
 * with a 30-day expiry so attribution data survives across sessions.
 *
 * Usage:
 *   Server:  const cookie = getUtmCookieString(request);  // returns Set-Cookie value or null
 *   Client:  (import { getUtmFromDocument } for client-side reads)
 *   Read:    getUtmCookie(request) → UTMData | null
 */

export interface UTMData {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

const COOKIE_NAME = "__utm";
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Extract UTM parameters from a Request's URL query string and return
 * a Set-Cookie header value suitable for setting on a Response.
 *
 * Returns null if no UTM params are present in the URL.
 *
 * IMPORTANT: Callers MUST set this on the outgoing Response —
 * this function does NOT mutate any global state.
 */
export function getUtmCookieString(request: Request): string | null {
  const url = new URL(request.url);
  const data: UTMData = {};

  for (const [key, value] of url.searchParams) {
    if (key === "utm_source") data.utm_source = value;
    else if (key === "utm_medium") data.utm_medium = value;
    else if (key === "utm_campaign") data.utm_campaign = value;
    else if (key === "utm_content") data.utm_content = value;
    else if (key === "utm_term") data.utm_term = value;
  }

  // Only set cookie if at least one UTM param exists
  if (Object.keys(data).length === 0) return null;

  const encoded = encodeURIComponent(JSON.stringify(data));
  return `${COOKIE_NAME}=${encoded}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}

/**
 * Convenience wrapper: call this from a server handler that has access to
 * both the Request and a way to set response headers. Returns the UTM data
 * that was captured (or null).
 *
 * Example (in a route handler):
 *   const utmCookie = setUtmCookie(request); // DEPRECATED alias — use getUtmCookieString
 */
export function setUtmCookie(request: Request): string | null {
  return getUtmCookieString(request);
}

/**
 * Read and parse the `__utm` cookie back into a typed UTMData object.
 * Returns null if the cookie is absent or malformed.
 *
 * Works both server-side (from Request headers) and client-side
 * (from document.cookie — see getUtmFromDocument).
 */
export function getUtmCookie(request: Request): UTMData | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));

  if (!match) return null;

  const raw = match.slice(COOKIE_NAME.length + 1);
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    // Validate shape — only allow known UTM keys
    const result: UTMData = {};
    const allowedKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
    for (const key of allowedKeys) {
      if (typeof parsed[key] === "string") {
        (result as any)[key] = parsed[key];
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

/**
 * Client-side helper: read UTM data from document.cookie.
 * Use this inside React components or client-side scripts.
 */
export function getUtmFromDocument(): UTMData | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));

  if (!match) return null;

  const raw = match.slice(COOKIE_NAME.length + 1);
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    const result: UTMData = {};
    const allowedKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
    for (const key of allowedKeys) {
      if (typeof parsed[key] === "string") {
        (result as any)[key] = parsed[key];
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

/**
 * Client-side: set UTM cookie from current URL's query params.
 * Call this on page load to capture UTM params when server-side
 * cookie setting isn't available (e.g., SPA navigation).
 */
export function captureUtmFromUrl(): void {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  const data: UTMData = {};

  url.searchParams.forEach((value, key) => {
    if (key === "utm_source") data.utm_source = value;
    else if (key === "utm_medium") data.utm_medium = value;
    else if (key === "utm_campaign") data.utm_campaign = value;
    else if (key === "utm_content") data.utm_content = value;
    else if (key === "utm_term") data.utm_term = value;
  });

  if (Object.keys(data).length === 0) return;

  const encoded = encodeURIComponent(JSON.stringify(data));
  document.cookie = `${COOKIE_NAME}=${encoded};max-age=${COOKIE_MAX_AGE_SECONDS};path=/;samesite=lax`;
}
