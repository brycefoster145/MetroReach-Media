import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, ChartLineUp, Lightbulb, Target } from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { Button } from "~/components/Button";
import { Badge } from "~/components/Badge";
import { caseStudiesPage } from "~/data/pages";

export const Route = createFileRoute("/case-studies")({
  component: CaseStudies,
});

function CaseStudies() {
  return (
    <section className="py-24 bg-bg-surface min-h-dvh">
      <Container>
        <SectionHeading
          headline={caseStudiesPage.headline}
          description={caseStudiesPage.subheadline}
        />

        <div className="max-w-5xl mx-auto space-y-12">
          {caseStudiesPage.studies.map((study, i) => (
            <div
              key={i}
              className="rounded-2xl bg-bg-surface-raised border border-border-subtle p-8 md:p-10 card-hover"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-2xl font-semibold font-heading text-text-primary">
                    {study.name}
                  </h3>
                  <p className="text-sm text-text-muted mt-1">{study.industry}</p>
                </div>
                <Badge className="text-brand-accent border-brand-accent/20 bg-brand-accent/5">
                  {study.industry.split(" — ")[0]}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Target size={20} weight="duotone" className="text-brand-accent" />
                    <h4 className="text-sm font-semibold font-heading text-text-primary uppercase tracking-wider">
                      The Challenge
                    </h4>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {study.challenge}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb size={20} weight="duotone" className="text-brand-primary" />
                    <h4 className="text-sm font-semibold font-heading text-text-primary uppercase tracking-wider">
                      Our Approach
                    </h4>
                  </div>
                  <ul className="space-y-2">
                    {study.approach.map((step, j) => (
                      <li
                        key={j}
                        className="flex items-start gap-2 text-sm text-text-secondary leading-relaxed"
                      >
                        <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-brand-primary mt-2" />
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-xl bg-bg-root border border-border-subtle p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <ChartLineUp size={20} weight="duotone" className="text-brand-accent" />
                  <h4 className="text-sm font-semibold font-heading text-text-primary uppercase tracking-wider">
                    Results
                  </h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-xs text-text-muted mb-1">Before</p>
                    <p className="text-sm text-text-secondary">{study.results.before}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted mb-1">After</p>
                    <p className="text-sm text-brand-accent font-semibold">{study.results.after}</p>
                  </div>
                </div>
              </div>

              <blockquote className="border-l-[3px] border-brand-primary pl-5">
                <p className="text-sm text-text-secondary italic leading-relaxed">
                  &ldquo;{study.quote}&rdquo;
                </p>
                <footer className="mt-2 text-xs text-text-muted">
                  &mdash; {study.personName}, {study.title}
                </footer>
              </blockquote>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-text-muted mt-16">
          More case studies coming soon.
        </p>

        <div className="mt-10 text-center">
          <p className="text-lg text-text-secondary mb-6">{caseStudiesPage.cta}</p>
          <Button href="/contact">
            Get started
            <ArrowRight size={18} weight="bold" />
          </Button>
        </div>
      </Container>
    </section>
  );
}
