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
    <div className={`${centered ? "text-center" : ""} mb-24`}>
      {badge && (
        <p className="text-sm font-semibold text-brand-accent uppercase tracking-[0.2em] mb-4">
          {badge}
        </p>
      )}
      <h2 className="text-5xl md:text-6xl lg:text-7xl font-extrabold font-heading text-text-primary tracking-tight leading-[1.1]">
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
