import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, CheckCircle, ClipboardText, ArrowRight } from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { Button } from "~/components/Button";
import { demoPage } from "~/data/pages";

export const Route = createFileRoute("/demo")({
  component: Demo,
});

function Demo() {
  return (
    <section className="py-24 bg-bg-surface min-h-dvh">
      <Container>
        <SectionHeading
          headline={demoPage.headline}
          description={demoPage.subheadline}
        />

        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
          {/* What you'll get */}
          <div className="rounded-2xl bg-bg-surface-raised border border-border-subtle p-8">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle
                size={28}
                weight="duotone"
                className="text-brand-accent"
              />
              <h3 className="text-lg font-semibold font-heading text-text-primary">
                What you'll get
              </h3>
            </div>
            <ul className="space-y-4">
              {demoPage.takeaways.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-sm text-text-secondary leading-relaxed"
                >
                  <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-brand-accent mt-2" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* What to prepare */}
          <div className="rounded-2xl bg-bg-surface-raised border border-border-subtle p-8">
            <div className="flex items-center gap-3 mb-6">
              <ClipboardText
                size={28}
                weight="duotone"
                className="text-brand-primary"
              />
              <h3 className="text-lg font-semibold font-heading text-text-primary">
                What to prepare
              </h3>
            </div>
            <ul className="space-y-4">
              {demoPage.prepare.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-sm text-text-secondary leading-relaxed"
                >
                  <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-brand-primary mt-2" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Time commitment note */}
        <div className="max-w-2xl mx-auto text-center mb-12">
          <div className="flex items-center justify-center gap-2 text-text-muted mb-2">
            <CalendarCheck size={20} weight="regular" className="text-brand-accent" />
            <span className="text-sm font-medium">Time commitment</span>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">
            {demoPage.timeCommitment}
          </p>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button href={demoPage.bookingUrl || "/contact"}>
            Book a strategy call
            <ArrowRight size={18} weight="bold" />
          </Button>
        </div>
      </Container>
    </section>
  );
}
