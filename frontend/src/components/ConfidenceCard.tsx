import { ShieldCheck, ShieldAlert } from "lucide-react";
import type { Confidence, Lang } from "../types";

const BAND_LABEL: Record<string, { en: string; sq: string }> = {
  High: { en: "High confidence", sq: "Besueshmëri e lartë" },
  Moderate: { en: "Moderate confidence", sq: "Besueshmëri mesatare" },
  Low: { en: "Low confidence", sq: "Besueshmëri e ulët" },
};

function barColor(band: string) {
  return band === "High" ? "bg-low" : band === "Moderate" ? "bg-medium" : "bg-high";
}

export default function ConfidenceCard({
  confidence,
  lang = "en",
}: {
  confidence: Confidence;
  lang?: Lang;
}) {
  const { score, band } = confidence;
  const note = lang === "sq" ? confidence.note_sq || confidence.note : confidence.note;
  const label = (BAND_LABEL[band] ?? BAND_LABEL.Moderate)[lang];

  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          {lang === "sq" ? "Besueshmëria e AI" : "AI Confidence"}
        </h3>
        <span className="text-sm font-semibold tabular-nums text-slate-100">
          {score}%
        </span>
      </div>

      <div className="mb-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-700/40">
        <div
          className={`h-full rounded-full ${barColor(band)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="mb-3 text-xs font-medium text-slate-400">{label}</div>

      {(() => {
        // three states by band: confident / verify / double-check
        const state =
          band === "High"
            ? {
                tone: "border-low/40 bg-low/10 text-low",
                Icon: ShieldCheck,
                title:
                  lang === "sq"
                    ? "AI është i sigurt për këtë analizë"
                    : "AI is confident in this analysis",
              }
            : band === "Moderate"
            ? {
                tone: "border-medium/40 bg-medium/10 text-medium",
                Icon: ShieldAlert,
                title:
                  lang === "sq"
                    ? "Verifikoni gjetjet kryesore"
                    : "Verify the key findings",
              }
            : {
                tone: "border-high/40 bg-high/10 text-high",
                Icon: ShieldAlert,
                title:
                  lang === "sq"
                    ? "Rekomandohet rishikim nga radiologu"
                    : "Radiologist double-check recommended",
              };
        const Icon = state.Icon;
        return (
          <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${state.tone}`}>
            <Icon size={16} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">{state.title}</div>
              {note && <div className="mt-0.5 text-xs text-slate-300">{note}</div>}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
