/**
 * Client Portal Authentication — MetroReach Digital
 *
 * Magic-link login for client portal. Uses HMAC-SHA256 JWTs signed with
 * a secret derived from environment variables. Tokens expire in 1 hour.
 *
 * All functions are server-only — import only from server-side code
 * (createServerFn handlers, API routes, server loaders).
 */

import crypto from "node:crypto";

// ── Token config ──

const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const COOKIE_NAME = "metroreach_client_token";

function getJwtSecret(): string {
  // Derive from env — MS_API_KEY is always set in production
  const base = process.env.MS_API_KEY || process.env.DATABASE_URL || "metroreach-dev-secret";
  return `client-portal:v1:${base.slice(0, 64)}`;
}

// ── Base64url helpers ──

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlDecode(str: string): Buffer {
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

// ── JWT create / verify ──

export interface ClientJwtPayload {
  sub: string; // client ID
  email: string;
  iat: number;
  exp: number;
}

/**
 * Create a signed JWT for a client. Returns the token string.
 */
export function createClientToken(clientId: string, email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload: ClientJwtPayload = {
    sub: clientId,
    email,
    iat: now,
    exp: now + TOKEN_EXPIRY_MS / 1000,
  };

  const headerB64 = base64url(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64url(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const secret = getJwtSecret();
  const signature = crypto.createHmac("sha256", secret).update(signingInput).digest();
  const signatureB64 = base64url(signature);

  return `${signingInput}.${signatureB64}`;
}

/**
 * Verify a JWT and return the payload. Returns null if invalid or expired.
 */
export function verifyClientToken(token: string): ClientJwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const signingInput = `${headerB64}.${payloadB64}`;

    const secret = getJwtSecret();
    const expectedSig = crypto.createHmac("sha256", secret).update(signingInput).digest();
    const actualSig = base64urlDecode(signatureB64);

    if (!crypto.timingSafeEqual(expectedSig, actualSig)) return null;

    const payload: ClientJwtPayload = JSON.parse(
      base64urlDecode(payloadB64).toString("utf8"),
    );

    if (payload.exp * 1000 < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract and verify the client token from a Request's cookies.
 * Returns the payload or null.
 */
export function getClientFromRequest(request: Request): ClientJwtPayload | null {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifyClientToken(token);
}

/**
 * Generate a Set-Cookie header value for the client token.
 */
export function setTokenCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${TOKEN_EXPIRY_MS / 1000}; Secure`;
}

/**
 * Generate a Set-Cookie header value that clears the token.
 */
export function clearTokenCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0; Secure`;
}

// ── Helpers ──

function parseCookies(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key) result[key] = val;
  }
  return result;
}

/**
 * Generate a unique ID string.
 */
export function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(8).toString("hex")}`;
}
