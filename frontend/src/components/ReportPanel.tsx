import { useState } from "react";
import type { Report } from "../types";

export default function ReportPanel({ report }: { report: Report }) {
  const [lang, setLang] = useState<"en" | "sq">("en");
  const imp = lang === "en" ? report.impression_en : report.impression_sq;
  const rec = lang === "en" ? report.recommendation_en : report.recommendation_sq;

  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          AI Report
        </h3>
        <div className="flex overflow-hidden rounded-lg border border-edge text-xs">
          {(["en", "sq"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-3 py-1 font-medium ${
                lang === l ? "bg-accent/20 text-accent" : "text-slate-400"
              }`}
            >
              {l === "en" ? "EN" : "SQ"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 text-sm leading-relaxed">
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-500">
            {lang === "en" ? "Impression" : "Përshtypja"}
          </div>
          <p className="text-slate-200">{imp || "—"}</p>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-500">
            {lang === "en" ? "Recommendation" : "Rekomandimi"}
          </div>
          <p className="text-slate-200">{rec || "—"}</p>
        </div>
      </div>

      <p className="mt-4 border-t border-edge pt-3 text-xs text-slate-500">
        AI decision support — not a definitive diagnosis. For clinician review.
      </p>
    </div>
  );
}
