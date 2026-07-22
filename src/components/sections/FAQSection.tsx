import { useEffect, useRef, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { faq } from "~/data/content";

function FAQItem({
  question,
  answer,
  defaultOpen,
  visible,
  delay,
}: {
  question: string;
  answer: string;
  defaultOpen: boolean;
  visible: boolean;
  delay: number;
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

  // Transform answer text to handle links (industry mentions)
  const renderAnswer = (text: string) => {
    return text;
  };

  return (
    <details
      ref={detailsRef}
      open={defaultOpen}
      className={`group border-b border-border-subtle transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
      style={{
        transitionDelay: `${delay}ms`,
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <summary className="flex items-center justify-between py-5 cursor-pointer hover:text-text-primary list-none">
        <span className="text-lg font-medium text-text-primary pr-4">
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
          <p className="text-base text-text-secondary leading-relaxed pb-6">
            {renderAnswer(answer)}
          </p>
        </div>
      </div>
    </details>
  );
}

export function FAQSection() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} className="py-24 bg-bg-surface">
      <Container>
        <div className="max-w-4xl mx-auto">
          <SectionHeading headline={faq.headline} />

          <div className="mt-8">
            {faq.items.map((item, i) => (
              <FAQItem
                key={i}
                question={item.question}
                answer={item.answer}
                defaultOpen={i === 0}
                visible={visible}
                delay={i * 60}
              />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
