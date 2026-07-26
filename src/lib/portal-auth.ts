/**
 * Portal Auth — MetroReach Digital
 *
 * Invite-code-based authentication for the new /portal.
 * MetroReach creates a client with a unique portal_token,
 * client visits /portal?token=XXX to access their portal.
 *
 * Uses the same JWT cookie mechanism as client-auth for
 * session persistence after the initial invite-code login.
 */

import crypto from "node:crypto";
import { getClientFromRequest, setTokenCookie, clearTokenCookie, createClientToken, verifyClientToken, generateId } from "./client-auth";

export { setTokenCookie, clearTokenCookie, createClientToken, verifyClientToken, generateId, getClientFromRequest };

/**
 * Generate a unique portal invite token.
 */
export function generatePortalToken(): string {
  return `mrm_${crypto.randomBytes(16).toString("hex")}`;
}

/**
 * Cookie name for portal sessions (same cookie as client-auth).
 */
export const PORTAL_COOKIE = "metroreach_client_token";
