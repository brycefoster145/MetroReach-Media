import { createFileRoute } from "@tanstack/react-router";
import { Container } from "~/components/Container";
import { cookiePolicyPage } from "~/data/pages";

export const Route = createFileRoute("/cookie-policy")({
  component: CookiePolicy,
});

function CookiePolicy() {
  return (
    <section className="py-24 bg-bg-root min-h-dvh">
      <Container>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold font-heading text-text-primary mb-2">
            {cookiePolicyPage.headline}
          </h1>
          <p className="text-sm text-text-muted mb-12">
            Last updated: {cookiePolicyPage.lastUpdated}
          </p>

          <div className="space-y-10">
            {cookiePolicyPage.sections.map((section, i) => (
              <div key={i}>
                <h2 className="text-lg font-semibold font-heading text-text-primary mb-3">
                  {section.heading}
                </h2>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {section.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
