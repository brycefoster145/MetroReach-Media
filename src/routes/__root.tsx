import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { siteMeta } from "~/data/content";
import { Navbar } from "~/components/Navbar";
import { Footer } from "~/components/Footer";

import appCss from "~/styles/app.css?url";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "MetroReach Media",
  description: siteMeta.description,
  url: "https://metroreachagency.com",
  contactPoint: {
    "@type": "ContactPoint",
    email: "hello@metroreachagency.com",
    contactType: "sales",
  },
};

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: siteMeta.title },
      { name: "description", content: siteMeta.description },
      { property: "og:title", content: siteMeta.title },
      { property: "og:description", content: siteMeta.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: siteMeta.title },
      { name: "twitter:description", content: siteMeta.description },
      { property: "og:image", content: "https://metroreachagency.com/images/og-image.webp" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: "https://metroreachagency.com/images/og-image.webp" },
    ],
    links: [
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&family=Space+Grotesk:wght@400;500;600;700&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(jsonLd),
      },
    ],
  }),
  notFoundComponent: () => (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-6 px-6 text-center bg-bg-root">
      <h1 className="text-4xl md:text-5xl font-bold font-heading text-text-primary">
        Page not found.
      </h1>
      <p className="text-lg text-text-secondary max-w-md">
        But our team of specialists is ready to help.
      </p>
      <a
        href="/"
        className="inline-flex items-center gap-2 rounded-full bg-brand-primary text-text-primary px-8 py-3.5 text-base font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-accent transition-all duration-200"
      >
        Back to homepage →
      </a>
    </div>
  ),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Navbar />
      <Outlet />
      <Footer />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg-root text-text-primary antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
