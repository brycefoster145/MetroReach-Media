# Buffer client lifecycle

`POST /api/stripe/webhook` verifies Stripe signatures with `STRIPE_WEBHOOK_SECRET` and handles `checkout.session.completed` plus `customer.subscription.deleted`.

## Honest Buffer limitation

Buffer's public GraphQL API used by this project exposes post operations (including `deletePost`) but does not expose a public server-side channel creation or channel disconnect mutation. The webhook therefore **does not fabricate channel IDs** and never calls `deletePost` with a channel ID (that would be a destructive type error).

On purchase it:

1. Creates/updates the existing client through the current checkout pipeline.
2. Inserts one `pending_manual` `client_channels` row for each requested supported platform.
3. Sends an internal email to `BUFFER_CHANNEL_ADMIN_EMAIL` describing the OAuth setup required.
4. Logs and skips LLC-gated platforms (LinkedIn Company Page, TikTok, YouTube, X).

After manual Buffer OAuth, an admin links the real channel ID:

```http
POST /api/admin/client-channels
x-api-key: $MS_API_KEY
Content-Type: application/json

{"id":"channel-...","buffer_channel_id":"..."}
```

`GET /api/admin/client-channels` lists pending/active/cancelled records. Agency channel IDs are rejected and seeded as `agency_reference` records for safety.

On `customer.subscription.deleted`, client channels are marked `cancelled`. Any linked client channel is logged for manual Buffer disconnect; agency channels are never touched.

## Environment

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET` (Stripe Dashboard → Developers → Webhooks)
- `DATABASE_URL`
- `BUFFER_ACCESS_TOKEN` (documented for future supported Buffer operations)
- `BUFFER_CHANNEL_ADMIN_EMAIL` (optional; defaults to support@metroreachagency.com)
- Existing email provider variables (`SENDGRID_API_KEY` or Microsoft Graph variables)
