import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import { Hero } from "~/components/sections/Hero";
import { ProblemSection } from "~/components/sections/ProblemSection";
import { SolutionSection } from "~/components/sections/SolutionSection";
import { ServicesSection } from "~/components/sections/ServicesSection";
import { ProcessSection } from "~/components/sections/ProcessSection";
import { PortfolioSection } from "~/components/sections/PortfolioSection";
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

      <ProblemSection />
      <div className="section-divider" />
      <SolutionSection />
      <div className="section-divider" />
      <ServicesSection />
      <div className="section-divider" />
      <ProcessSection />
      <div className="section-divider" />
      <PortfolioSection />
      <div className="section-divider" />
      <SocialProof />
      <div className="section-divider" />
      <PricingSection />
      <div className="section-divider" />
      <FAQSection />
      <div className="section-divider" />
      <ContactSection />
    </main>
  );
}
