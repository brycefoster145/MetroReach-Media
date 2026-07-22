import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { Button } from "~/components/Button";
import { aboutPage } from "~/data/pages";

export const Route = createFileRoute("/about")({
  component: About,
});

function About() {
  return (
    <section className="py-24 bg-bg-surface min-h-dvh">
      <Container>
        <SectionHeading headline={aboutPage.headline} />

        {/* Body paragraphs */}
        <div className="max-w-3xl mx-auto space-y-6 mb-20">
          {aboutPage.body.map((para, i) => (
            <p key={i} className="text-lg text-text-secondary leading-relaxed">
              {para}
            </p>
          ))}
        </div>

        {/* What we believe */}
        <div className="mb-20">
          <h2 className="text-2xl font-bold font-heading text-text-primary mb-10 text-center">
            What we believe
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {aboutPage.beliefs.map((belief, i) => (
              <div
                key={i}
                className="rounded-2xl bg-bg-surface-raised border border-border-subtle p-8 card-hover"
              >
                <h3 className="text-lg font-semibold font-heading text-text-primary mb-3">
                  {belief.heading}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {belief.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* How we operate */}
        <div className="mb-20 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold font-heading text-text-primary mb-6 text-center">
            How we operate
          </h2>
          <p className="text-lg text-text-secondary leading-relaxed text-center">
            {aboutPage.howWeOperate}
          </p>
        </div>

        {/* Who we're for */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold font-heading text-text-primary mb-6 text-center">
            Who we're for
          </h2>
          <p className="text-lg text-text-secondary leading-relaxed text-center">
            {aboutPage.whoWereFor}
          </p>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <p className="text-lg text-text-secondary mb-6">{aboutPage.cta}</p>
          <Button href="/book">
            Book a strategy call
            <ArrowRight size={18} weight="bold" />
          </Button>
        </div>
      </Container>
    </section>
  );
}
