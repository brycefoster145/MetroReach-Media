import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { Button } from "~/components/Button";
import { platformsPage } from "~/data/pages";

export const Route = createFileRoute("/platforms")({
  component: Platforms,
});

function Platforms() {
  return (
    <section className="py-24 bg-bg-root min-h-dvh">
      <Container>
        <SectionHeading
          headline={platformsPage.headline}
          description={platformsPage.subheadline}
        />

        <p className="max-w-3xl mx-auto text-center text-sm text-text-secondary leading-relaxed mb-16">
          {platformsPage.philosophy}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {platformsPage.platformBlocks.map((platform) => (
            <div
              key={platform.name}
              className="rounded-2xl bg-bg-surface border border-border-subtle p-6 card-hover"
            >
              <h3 className="text-xl font-semibold font-heading text-text-primary mb-2">
                {platform.name}
              </h3>
              <p className="text-sm text-brand-accent font-medium mb-4">
                {platform.tagline}
              </p>
              <p className="text-sm text-text-secondary leading-relaxed mb-5">
                {platform.description}
              </p>
              <ul className="space-y-2">
                {platform.items.map((item, j) => (
                  <li
                    key={j}
                    className="flex items-start gap-2 text-xs text-text-muted leading-relaxed"
                  >
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-brand-primary mt-1.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-lg text-text-secondary mb-6">{platformsPage.cta}</p>
          <Button href="/contact">
            Get started
            <ArrowRight size={18} weight="bold" />
          </Button>
        </div>
      </Container>
    </section>
  );
}
