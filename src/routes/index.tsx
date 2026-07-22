import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import { Hero } from "~/components/sections/Hero";
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
