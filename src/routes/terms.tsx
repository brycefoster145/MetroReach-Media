import { createFileRoute } from "@tanstack/react-router";
import { Container } from "~/components/Container";
import { termsPage } from "~/data/pages";

export const Route = createFileRoute("/terms")({
  component: Terms,
});

function Terms() {
  return (
    <section className="py-24 bg-bg-surface min-h-dvh">
      <Container>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold font-heading text-text-primary mb-2">
            {termsPage.headline}
          </h1>
          <p className="text-sm text-text-muted mb-12">
            Last updated: {termsPage.lastUpdated}
          </p>

          <div className="space-y-10">
            {termsPage.sections.map((section, i) => (
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
