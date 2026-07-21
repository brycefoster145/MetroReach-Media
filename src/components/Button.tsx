import type { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  href?: string;
  type?: "button" | "submit";
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function Button({
  children,
  variant = "primary",
  href,
  type = "button",
  className = "",
  onClick,
  disabled,
}: ButtonProps) {
  const base =
    "inline-flex items-center gap-2 font-semibold transition-all duration-200 ease-out cursor-pointer";

  const variants: Record<string, string> = {
    primary:
      "bg-brand-primary text-text-primary rounded-full px-8 py-3.5 text-base hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-accent hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:scale-[1.02]",
    secondary:
      "text-text-secondary hover:text-text-primary group text-base",
    ghost:
      "border border-border-emphasis text-text-primary rounded-full px-6 py-2.5 text-sm hover:border-brand-primary hover:text-brand-primary",
  };

  const cls = `${base} ${variants[variant]} ${className}`;

  if (href) {
    return (
      <a href={href} className={cls} onClick={onClick}>
        {children}
        {variant === "secondary" && (
          <span className="inline-block transition-transform duration-150 group-hover:translate-x-1">
            →
          </span>
        )}
      </a>
    );
  }

  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
