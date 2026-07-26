/**
 * /client — Redirects to new Client Portal
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/client/")({
  component: ClientLoginRedirect,
});

function ClientLoginRedirect() {
  useEffect(() => {
    // Preserve ?token= if present, map to /portal?token=
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const dest = token ? `/portal?token=${encodeURIComponent(token)}` : "/portal";
    window.location.href = dest;
  }, []);

  return (
    <main className="min-h-dvh bg-bg-root flex items-center justify-center px-4">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-2 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin mb-4" />
        <p className="text-sm text-text-secondary">
          Redirecting to the new Client Portal...
        </p>
      </div>
    </main>
  );
}
