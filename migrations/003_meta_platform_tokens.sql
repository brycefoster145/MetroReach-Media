-- 003_meta_platform_tokens.sql
-- Split legacy Meta OAuth rows into the platform values consumed by the pipeline.
-- Idempotent: rerunning this migration never creates duplicate platform/page rows.
-- Legacy rows with a long business-account ID are treated as Instagram; shorter
-- page IDs are treated as Facebook. Clients without a legacy Instagram row get
-- an explicit pending row and can reconnect from the portal.

INSERT INTO client_platform_tokens
  (client_id, platform, access_token, page_id, account_name, expires_at, token_status)
SELECT DISTINCT ON (t.client_id)
  t.client_id, 'facebook', t.access_token, t.page_id, t.account_name,
  t.expires_at, t.token_status
FROM client_platform_tokens t
WHERE t.platform = 'meta'
  AND t.page_id IS NOT NULL
  AND length(t.page_id) <= 20
  AND NOT EXISTS (
    SELECT 1 FROM client_platform_tokens existing
    WHERE existing.client_id = t.client_id
      AND existing.platform = 'facebook'
  )
ORDER BY t.client_id, t.created_at DESC;

INSERT INTO client_platform_tokens
  (client_id, platform, access_token, page_id, account_name, expires_at, token_status)
SELECT DISTINCT ON (t.client_id)
  t.client_id, 'instagram', t.access_token, t.page_id, t.account_name,
  t.expires_at, t.token_status
FROM client_platform_tokens t
WHERE t.platform = 'meta'
  AND t.page_id IS NOT NULL
  AND length(t.page_id) > 20
  AND NOT EXISTS (
    SELECT 1 FROM client_platform_tokens existing
    WHERE existing.client_id = t.client_id
      AND existing.platform = 'instagram'
  )
ORDER BY t.client_id, t.created_at DESC;

INSERT INTO client_platform_tokens
  (client_id, platform, access_token, page_id, account_name, expires_at, token_status)
SELECT DISTINCT t.client_id, 'instagram', t.access_token, 'pending',
  'Instagram (reconnect required)', t.expires_at, 'inactive'
FROM client_platform_tokens t
WHERE t.platform = 'meta'
  AND t.page_id IS NOT NULL
  AND length(t.page_id) <= 20
  AND NOT EXISTS (
    SELECT 1 FROM client_platform_tokens existing
    WHERE existing.client_id = t.client_id
      AND existing.platform = 'instagram'
  );
