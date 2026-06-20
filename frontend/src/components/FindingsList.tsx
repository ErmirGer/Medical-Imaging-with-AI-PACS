import type { Finding } from "../types";

export default function FindingsList({ findings }: { findings: Finding[] }) {
  const hasBaseline = findings.some((f) => f.population_rate != null);
  return (
    <div className="space-y-2.5">
      {findings.map((f) => {
        const pct = Math.round(f.probability * 100);
        const strong = f.probability >= 0.5;
        const popPct =
          f.population_rate != null ? Math.round(f.population_rate * 100) : null;
        return (
          <div key={f.pathology}>
            <div className="flex items-center justify-between text-sm">
              <span className={strong ? "text-slate-100 font-medium" : "text-slate-400"}>
                {f.pathology}
              </span>
              <span className="tabular-nums text-slate-400">{pct}%</span>
            </div>
            <div className="relative mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-700/40">
              <div
                className={`h-full rounded-full ${
                  f.probability >= 0.7
                    ? "bg-high"
                    : f.probability >= 0.4
                    ? "bg-medium"
                    : "bg-accent/70"
                }`}
                style={{ width: `${pct}%` }}
              />
              {popPct != null && (
                <span
                  className="absolute top-0 h-full w-px bg-slate-300/70"
                  style={{ left: `${popPct}%` }}
                  title={`Population baseline: ${popPct}%`}
                />
              )}
            </div>
          </div>
        );
      })}
      {hasBaseline && (
        <p className="pt-1 text-[10px] text-slate-500">
          <span className="mr-1 inline-block h-2 w-px bg-slate-300/70 align-middle" />
          marks population baseline prevalence
        </p>
      )}
    </div>
  );
}
