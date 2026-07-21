interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-block text-xs font-medium rounded-full px-3 py-1 bg-bg-surface-raised border border-border-subtle text-text-muted ${className}`}
    >
      {children}
    </span>
  );
}
