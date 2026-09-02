# Google Ads API — OAuth Setup

The `/api/mcp/google-ads` MCP server authenticates to the Google Ads API with
an OAuth 2.0 **refresh-token flow** — no static, expiring access token needed.

## How it works

1. The owner (admin) authorizes Google Ads access once via OAuth.
2. The refresh token is stored in `client_platform_tokens`
   (`platform = 'google_ads'`, `client_id = 'metroreach'`).
3. On every Google Ads MCP call, the server exchanges the stored refresh token
   at `https://oauth2.googleapis.com/token` for a fresh ~1h access token,
   caches it in memory, and refreshes again when it nears expiry.
4. `GOOGLE_ADS_ACCESS_TOKEN` (static env var) is kept only as a last-resort
   fallback and is no longer required. `GOOGLE_ADS_DEVELOPER_TOKEN` IS required.

## Owner-facing authorize URL

**Visit: https://metroreachagency.com/api/admin/google-ads-auth**

- First visit redirects to Google's consent screen (scope
  `https://www.googleapis.com/auth/adwords` + offline access).
- After approving, the callback stores the refresh token and shows a
  "✅ Google Ads Connected!" page.

## Required Google Cloud Console steps (one-time)

1. **Enable the Google Ads API** for the GCP project behind
   `GOOGLE_CLIENT_ID`:
   Cloud Console → APIs & Services → Library → search "Google Ads API" →
   Enable. This is required for any token to work against
   `googleads.googleapis.com`.
2. **Add `https://www.googleapis.com/auth/adwords` to the OAuth consent
   screen** (APIs & Services → OAuth consent screen → Add or remove scopes) if
   it is not already listed.
3. **Add the callback URI** to the OAuth client
   (APIs & Services → Credentials → your OAuth 2.0 Client ID → Authorized
   redirect URIs):
   `https://metroreachagency.com/api/admin/google-ads-auth`
4. **Restricted-scope warning:** `adwords` is a restricted scope. Until the
   app passes Google's verification, the consent screen shows
   "Google hasn't verified this app" and only accounts you add as **Test
   users** can authorize. Acceptable for internal use — add the owner's Google
   account under OAuth consent screen → Test users.
5. **Two-step verification:** As of 2025 Google requires 2-Step Verification
   (2SV) enabled on the authorizing Google account for new Google Ads API
   OAuth grants; existing refresh tokens keep working. If the callback errors
   with `TWO_STEP_VERIFICATION_NOT_ENROLLED`, enable 2SV on the account.

## Also available (shared-flow path)

The existing portal flow (`/api/portal/google-oauth`, callback
`/api/portal/google-oauth-callback`) now also requests the `adwords` scope
alongside its existing scopes. Authorizing there stores a refresh token on the
shared `google` platform row, which the Google Ads MCP falls back to if no
`google_ads` row exists. Clients connecting via the portal will see the
restricted-scope warning — acceptable for internal tooling today.

## Troubleshooting

- `No Google Ads access token available...` → owner hasn't completed
  `/api/admin/google-ads-auth` and no env fallback is set.
- `Google token refresh failed: invalid_grant` → refresh token was revoked;
  re-run the authorize URL.
- Callback shows a 400 "state mismatch" → session cookie was cleared; open
  the authorize URL fresh.