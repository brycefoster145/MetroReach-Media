import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, LockKey, WarningCircle } from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { Button } from "~/components/Button";
import { securityPage } from "~/data/pages";

export const Route = createFileRoute("/security")({
  component: Security,
});

function Security() {
  return (
    <section className="py-24 bg-bg-surface min-h-dvh">
      <Container>
        <SectionHeading
          headline={securityPage.headline}
          description={securityPage.subheadline}
        />

        <div className="max-w-4xl mx-auto space-y-20">
          {/* Data Handling */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <LockKey size={24} weight="duotone" className="text-brand-primary" />
              <h3 className="text-xl font-semibold font-heading text-text-primary">
                Data Handling
              </h3>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed mb-6">
              {securityPage.dataHandling.access}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {securityPage.dataHandling.storage.map((item, i) => (
                <div
                  key={i}
                  className="rounded-xl bg-bg-surface-raised border border-border-subtle p-5"
                >
                  <p className="text-sm text-text-secondary leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-text-secondary leading-relaxed mt-6">
              {securityPage.dataHandling.customerData}
            </p>
            <p className="text-sm text-text-secondary leading-relaxed mt-4">
              {securityPage.dataHandling.retention}
            </p>
          </div>

          {/* Platform Compliance */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <ShieldCheck size={24} weight="duotone" className="text-brand-accent" />
              <h3 className="text-xl font-semibold font-heading text-text-primary">
                Platform Compliance
              </h3>
            </div>
            <div className="space-y-4">
              {securityPage.platformCompliance.map((item, i) => (
                <div
                  key={i}
                  className="rounded-xl bg-bg-surface-raised border border-border-subtle p-5"
                >
                  <h4 className="text-sm font-semibold font-heading text-text-primary mb-2">
                    {item.name}
                  </h4>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Industry Guardrails */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <WarningCircle size={24} weight="duotone" className="text-warning" />
              <h3 className="text-xl font-semibold font-heading text-text-primary">
                Industry Guardrails
              </h3>
            </div>
            <div className="space-y-4">
              {securityPage.guardrails.map((item, i) => (
                <div
                  key={i}
                  className="rounded-xl bg-bg-surface-raised border border-border-subtle p-5"
                >
                  <h4 className="text-sm font-semibold font-heading text-text-primary mb-2">
                    {item.industry}
                  </h4>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="rounded-xl bg-bg-root border border-border-subtle p-6">
            <p className="text-xs text-text-muted leading-relaxed italic">
              {securityPage.disclaimer}
            </p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <Button href="/contact">
            Talk to us about your security requirements
            <ArrowRight size={18} weight="bold" />
          </Button>
        </div>
      </Container>
    </section>
  );
}
