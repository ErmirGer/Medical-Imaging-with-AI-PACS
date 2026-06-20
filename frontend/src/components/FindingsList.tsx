import type { Finding } from "../types";

export default function FindingsList({ findings }: { findings: Finding[] }) {
  return (
    <div className="space-y-2.5">
      {findings.map((f) => {
        const pct = Math.round(f.probability * 100);
        const strong = f.probability >= 0.5;
        return (
          <div key={f.pathology}>
            <div className="flex items-center justify-between text-sm">
              <span className={strong ? "text-slate-100 font-medium" : "text-slate-400"}>
                {f.pathology}
              </span>
              <span className="tabular-nums text-slate-400">{pct}%</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-700/40">
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
            </div>
          </div>
        );
      })}
    </div>
  );
}
