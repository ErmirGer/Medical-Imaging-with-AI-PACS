import type { Finding, Lang, Severity } from "../types";

// Color reflects clinical SEVERITY (not confidence): reassuring → green, urgent → red.
const SEV_BAR: Record<Severity, string> = {
  none: "bg-low",
  mild: "bg-accent/70",
  moderate: "bg-medium",
  severe: "bg-high",
};
const SEV_LABEL_EN: Record<Severity, string> = {
  none: "normal",
  mild: "mild",
  moderate: "moderate",
  severe: "severe",
};
const SEV_LABEL_SQ: Record<Severity, string> = {
  none: "normale",
  mild: "e lehtë",
  moderate: "e moderuar",
  severe: "e rëndë",
};

export default function FindingsList({
  findings,
  lang = "en",
}: {
  findings: Finding[];
  lang?: Lang;
}) {
  const hasBaseline = findings.some((f) => f.population_rate != null);
  return (
    <div className="space-y-2.5">
      {findings.map((f) => {
        const pct = Math.round(f.probability * 100);
        const sev: Severity = f.severity ?? "mild";
        const strong = sev === "severe" || sev === "moderate";
        const name = lang === "sq" && f.pathology_sq ? f.pathology_sq : f.pathology;
        const popPct =
          f.population_rate != null ? Math.round(f.population_rate * 100) : null;
        const sevLabel = lang === "sq" ? SEV_LABEL_SQ[sev] : SEV_LABEL_EN[sev];
        return (
          <div key={f.pathology}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className={strong ? "text-slate-100 font-medium" : "text-slate-300"}>
                {name}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">
                  {sevLabel}
                </span>
                <span className="tabular-nums text-slate-400">{pct}%</span>
              </span>
            </div>
            <div className="relative mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-700/40">
              <div
                className={`h-full rounded-full ${SEV_BAR[sev]}`}
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
      <p className="pt-1 text-[10px] text-slate-500">
        {lang === "sq"
          ? "Përqindja = besimi i AI · ngjyra = ashpërsia"
          : "% = AI confidence · color = severity"}
        {hasBaseline &&
          (lang === "sq"
            ? " · viza = mesatarja e popullatës"
            : " · tick = population baseline")}
      </p>
    </div>
  );
}
