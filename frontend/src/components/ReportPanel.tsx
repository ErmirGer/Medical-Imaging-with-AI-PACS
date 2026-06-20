import type { Lang, Report } from "../types";

export default function ReportPanel({
  report,
  lang,
}: {
  report: Report;
  lang: Lang;
}) {
  const imp = lang === "en" ? report.impression_en : report.impression_sq;
  const rec = lang === "en" ? report.recommendation_en : report.recommendation_sq;

  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
        AI Report
      </h3>

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
        {lang === "en"
          ? "AI decision support — not a definitive diagnosis. For clinician review."
          : "Mbështetje vendimi me AI — jo diagnozë përfundimtare. Për rishikim nga mjeku."}
      </p>
    </div>
  );
}
