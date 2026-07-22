interface SectionHeadingProps {
  badge?: string;
  headline: string;
  description?: string;
  centered?: boolean;
}

export function SectionHeading({
  badge,
  headline,
  description,
  centered = true,
}: SectionHeadingProps) {
  return (
    <div className={`${centered ? "text-center" : ""} mb-16`}>
      {badge && (
        <p className="text-sm font-semibold text-brand-accent uppercase tracking-widest mb-4">
          {badge}
        </p>
      )}
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold font-heading text-text-primary tracking-tight">
        {headline}
      </h2>
      {description && (
        <p className="mt-6 text-lg text-text-secondary max-w-2xl mx-auto">
          {description}
        </p>
      )}
    </div>
  );
}
