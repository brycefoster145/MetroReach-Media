import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { faqPage } from "~/data/pages";

export const Route = createFileRoute("/faq")({
  component: FAQ,
});

function FAQItem({
  question,
  answer,
  defaultOpen,
}: {
  question: string;
  answer: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const el = detailsRef.current;
    if (!el) return;
    const handler = () => setOpen(el.open);
    el.addEventListener("toggle", handler);
    return () => el.removeEventListener("toggle", handler);
  }, []);

  return (
    <details
      ref={detailsRef}
      open={defaultOpen}
      className="group border-b border-border-subtle"
    >
      <summary className="flex items-center justify-between py-5 cursor-pointer hover:text-text-primary list-none">
        <span className="text-lg font-medium text-text-primary pr-4 font-body">
          {question}
        </span>
        <CaretDown
          size={20}
          weight="bold"
          className={`text-text-muted flex-shrink-0 transition-transform duration-300 ${
            open ? "rotate-180 text-brand-primary" : ""
          }`}
        />
      </summary>
      <div className={`faq-answer ${open ? "open" : ""}`}>
        <div>
          <p className="text-base text-text-secondary leading-relaxed pb-6 font-body">
            {answer}
          </p>
        </div>
      </div>
    </details>
  );
}

function FAQ() {
  return (
    <section className="py-24 bg-bg-root min-h-dvh">
      <Container>
        <div className="max-w-3xl mx-auto">
          <SectionHeading headline={faqPage.headline} />

          <div className="mt-8">
            {faqPage.items.map((item, i) => (
              <FAQItem
                key={i}
                question={item.question}
                answer={item.answer}
                defaultOpen={i === 0}
              />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
