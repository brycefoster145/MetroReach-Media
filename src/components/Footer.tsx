import { footer } from "~/data/content";
import {
  FacebookLogo,
  InstagramLogo,
  LinkedinLogo,
  TiktokLogo,
  XLogo,
} from "@phosphor-icons/react";

const socialIconMap: Record<string, React.ComponentType<{ size?: number; weight?: "fill" | "bold" | "duotone"; className?: string }>> = {
  FacebookLogo,
  InstagramLogo,
  LinkedinLogo,
  TiktokLogo,
  XLogo,
};

export function Footer() {
  return (
    <footer className="border-t border-border-subtle bg-bg-root">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Logo column */}
          <div className="lg:col-span-2">
            <a
              href="/"
              className="text-lg font-bold font-heading text-text-primary"
            >
              {footer.company}
            </a>
            <p className="mt-2 text-sm text-text-muted max-w-xs">
              {footer.tagline}
            </p>
            {/* Social Media Links */}
            {footer.social && (
              <div className="flex items-center gap-4 mt-4">
                {footer.social.map((s) => {
                  const Icon = socialIconMap[s.icon];
                  return (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      className="text-text-muted hover:text-brand-primary transition-colors"
                    >
                      {Icon ? (
                        <Icon size={20} weight="fill" />
                      ) : (
                        <span className="text-xs font-medium">{s.label}</span>
                      )}
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Services */}
          <div>
            <h4 className="text-sm font-semibold text-text-primary mb-3 font-heading">
              Services
            </h4>
            <ul className="space-y-2">
              {footer.services.map((s) => (
                <li key={s}>
                  <a
                    href="/services"
                    className="text-sm text-text-muted hover:text-text-secondary transition-colors"
                  >
                    {s}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Markets + Legal */}
          <div>
            <h4 className="text-sm font-semibold text-text-primary mb-3 font-heading">
              Markets
            </h4>
            <ul className="space-y-2 mb-6">
              {footer.markets.map((m) => (
                <li key={m}>
                  <span className="text-sm text-text-muted">{m}</span>
                </li>
              ))}
            </ul>
            <h4 className="text-sm font-semibold text-text-primary mb-3 font-heading">
              Legal
            </h4>
            <ul className="space-y-2">
              {footer.legal.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="text-sm text-text-muted hover:text-text-secondary transition-colors"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border-subtle">
          <p className="text-xs text-text-muted text-center">
            {footer.copyright}
          </p>
        </div>
      </div>
    </footer>
  );
}
