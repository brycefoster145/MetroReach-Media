import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Check } from "@phosphor-icons/react";
import {
  FacebookLogo,
  InstagramLogo,
  TiktokLogo,
  GoogleLogo,
  YoutubeLogo,
  LinkedinLogo,
  XLogo,
  Article,
  Target,
  Brain,
  ChartLineUp,
  ChatCircleText,
} from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { Button } from "~/components/Button";
import { servicesPage } from "~/data/pages";

const iconMap: Record<string, React.ComponentType<{ size?: number; weight?: "fill" | "bold" | "duotone"; className?: string }>> = {
  Article,
  Target,
  Brain,
  ChartLineUp,
  ChatCircleText,
};

const platformIcons = [
  { Icon: FacebookLogo, label: "Facebook" },
  { Icon: InstagramLogo, label: "Instagram" },
  { Icon: TiktokLogo, label: "TikTok" },
  { Icon: GoogleLogo, label: "Google" },
  { Icon: YoutubeLogo, label: "YouTube" },
  { Icon: LinkedinLogo, label: "LinkedIn" },
  { Icon: XLogo, label: "X" },
];

export const Route = createFileRoute("/services")({
  component: Services,
});

function Services() {
  return (
    <main>
      {/* Hero */}
      <section className="relative py-24 lg:py-32 bg-bg-root overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_600px_at_50%_30%,rgba(59,130,246,0.06),transparent)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_400px_at_80%_60%,rgba(6,214,160,0.04),transparent)] pointer-events-none" />

        <Container className="relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs font-medium text-brand-accent uppercase tracking-widest mb-6">
              WHAT WE DO
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-heading text-text-primary tracking-tight leading-[1.05] mb-6">
              {servicesPage.headline}
            </h1>
            <p className="text-lg lg:text-xl text-text-secondary max-w-2xl mx-auto">
              {servicesPage.subheadline}
            </p>
          </div>
        </Container>
      </section>

      {/* Service Cards */}
      <section className="py-24 bg-bg-surface">
        <Container>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {servicesPage.services.map((svc, i) => {
              const IconComponent = iconMap[svc.icon];
              return (
                <div
                  key={svc.name}
                  className={`rounded-2xl bg-bg-surface-raised border border-border-subtle p-8 card-hover flex flex-col ${
                    i === 0 ? "lg:col-span-3 md:col-span-2" : ""
                  }`}
                >
                  <div className="flex items-center gap-4 mb-5">
                    {IconComponent && (
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                        <IconComponent size={24} weight="duotone" className="text-brand-primary" />
                      </div>
                    )}
                    <h3 className="text-xl font-semibold font-heading text-text-primary">
                      {svc.name}
                    </h3>
                  </div>
                  <ul className="space-y-3 flex-1">
                    {svc.bullets.map((bullet, j) => (
                      <li key={j} className="flex items-start gap-3 text-sm text-text-secondary leading-relaxed">
                        <Check
                          size={16}
                          weight="bold"
                          className="text-brand-accent flex-shrink-0 mt-0.5"
                        />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* Platform Badges */}
      <section className="py-20 bg-bg-root border-t border-border-subtle">
        <Container>
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold font-heading text-text-primary mb-4">
              Seven platforms. One team.
            </h2>
            <p className="text-text-secondary mb-10">
              We manage organic content and paid advertising across every platform that matters to service businesses.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              {platformIcons.map(({ Icon, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-2 text-text-muted hover:text-brand-primary transition-colors duration-200"
                  title={label}
                >
                  <Icon size={32} weight="fill" />
                  <span className="text-xs font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="py-20 bg-bg-surface border-t border-border-subtle">
        <Container>
          <div className="text-center max-w-xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold font-heading text-text-primary mb-4">
              {servicesPage.cta}
            </h2>
            <p className="text-text-secondary mb-8">
              Book a strategy call. No pitch deck. Just an honest conversation about your marketing.
            </p>
            <Button href="/contact">
              Start getting leads
              <ArrowRight size={18} weight="bold" />
            </Button>
          </div>
        </Container>
      </section>
    </main>
  );
}
