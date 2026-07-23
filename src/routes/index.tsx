import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import { Hero } from "~/components/sections/Hero";
import { Container } from "~/components/Container";
import { ProblemSection } from "~/components/sections/ProblemSection";
import { SolutionSection } from "~/components/sections/SolutionSection";
import { ServicesSection } from "~/components/sections/ServicesSection";
import { HowItWorks } from "~/components/sections/HowItWorks";
import { SocialProof } from "~/components/sections/SocialProof";
import { PricingSection } from "~/components/sections/PricingSection";
import { FAQSection } from "~/components/sections/FAQSection";
import { ContactSection } from "~/components/sections/ContactSection";

const getBusinessName = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const cfg = JSON.parse(await readFile("site.json", "utf8")) as {
      businessName?: string;
    };
    return cfg.businessName?.trim() ?? "";
  } catch {
    return "";
  }
});

export const Route = createFileRoute("/")({
  loader: () => getBusinessName(),
  component: Home,
});

function Home() {
  return (
    <main>
      <Hero />
      {/* Free Audit CTA Banner */}
      <section className="py-8 bg-bg-surface border-b border-border-subtle">
        <Container>
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-bg-surface-raised border border-brand-primary/20">
            <div>
              <p className="text-sm font-semibold text-text-primary">
                Not sure where your marketing stands?
              </p>
              <p className="text-sm text-text-secondary mt-0.5">
                Get a free, specialist-level audit of your digital presence — delivered in under a minute.
              </p>
            </div>
            <a
              href="/free-audit"
              className="flex-shrink-0 inline-flex items-center gap-2 rounded-full bg-brand-primary text-text-primary px-6 py-3 text-sm font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-accent hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all duration-200"
            >
              Get Your Free Audit →
            </a>
          </div>
        </Container>
      </section>
      <ProblemSection />
      <SolutionSection />
      <ServicesSection />
      <HowItWorks />
      <SocialProof />
      <PricingSection />
      <FAQSection />
      <ContactSection />
    </main>
  );
}
