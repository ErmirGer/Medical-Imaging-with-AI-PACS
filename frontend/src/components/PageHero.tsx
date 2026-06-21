import type { ReactNode } from "react";
import EcgLine from "./EcgLine";

export default function PageHero({
  title,
  subtitle,
  icon,
  right,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-edge edge-hl shadow-soft">
      {/* gradient wash */}
      <div className="absolute inset-0 bg-gradient-to-br from-panel via-surface to-ink" />
      <div className="pointer-events-none absolute -right-12 -top-20 h-60 w-96 rounded-full bg-accent/15 blur-3xl" />
      <EcgLine className="pointer-events-none absolute -bottom-1 left-0 h-16 w-2/3 text-accent/15" />

      <div className="relative flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div className="flex items-center gap-3.5">
          {icon && (
            <div className="rounded-2xl bg-brand-gradient p-3 text-slate-900 shadow-accent-glow">
              {icon}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tightest text-slate-50">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
          </div>
        </div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
    </div>
  );
}
