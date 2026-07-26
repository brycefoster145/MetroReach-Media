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
    <div className={`${centered ? "text-center" : ""} mb-20`}>
      {badge && (
        <p className="text-sm font-semibold text-brand-accent uppercase tracking-[0.2em] mb-4">
          {badge}
        </p>
      )}
      <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold font-heading text-text-primary tracking-tight">
        {headline}
      </h2>
      {description && (
        <p className="mt-8 text-xl text-text-primary-light max-w-2xl mx-auto leading-loose">
          {description}
        </p>
      )}
    </div>
  );
}
