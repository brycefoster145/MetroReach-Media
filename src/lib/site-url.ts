/**
 * Site URL helper — MetroReach Media
 *
 * Returns the correct public URL for the current environment.
 * Production ALWAYS uses the custom domain — never VERCEL_URL.
 * This is the single source of truth for site URL generation.
 * Every endpoint that builds URLs MUST use this function.
 */

export function getSiteUrl(): string {
  // Production: always use the custom domain
  if (process.env.VERCEL_ENV === "production") {
    return "https://metroreachagency.com";
  }
  // Preview/staging: Vercel provides the preview URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // Local development
  return process.env.SITE_URL || "http://localhost:3000";
}
