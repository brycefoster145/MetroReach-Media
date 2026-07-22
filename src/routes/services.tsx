import { createFileRoute } from "@tanstack/react-router";
import { Check, ArrowRight } from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { Button } from "~/components/Button";
import { servicesPage } from "~/data/pages";

export const Route = createFileRoute("/services")({
  component: Services,
});

function Services() {
  return (
    <section className="py-24 bg-bg-surface min-h-dvh">
      <Container>
        <SectionHeading
          headline={servicesPage.headline}
          description={servicesPage.subheadline}
        />

        <div className="space-y-20 max-w-4xl mx-auto">
          {servicesPage.blocks.map((block, i) => (
            <div
              key={block.name}
              className="rounded-2xl bg-bg-surface-raised border border-border-subtle p-8 md:p-10 card-hover"
            >
              <h3 className="text-2xl font-semibold font-heading text-text-primary mb-4">
                {block.name}
              </h3>
              <p className="text-base text-text-secondary leading-relaxed mb-8 max-w-2xl">
                {block.description}
              </p>
              <ul className="space-y-3">
                {block.details.map((detail, j) => (
                  <li
                    key={j}
                    className="flex items-start gap-3 text-sm text-text-secondary"
                  >
                    <Check
                      size={18}
                      weight="bold"
                      className="text-brand-accent flex-shrink-0 mt-0.5"
                    />
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Button href="/contact">
            Get started
            <ArrowRight size={18} weight="bold" />
          </Button>
        </div>
      </Container>
    </section>
  );
}
