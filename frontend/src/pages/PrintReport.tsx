import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { api } from "../api";
import { SnakeMark } from "../components/Logo";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex gap-2 py-0.5 text-sm">
      <span className="w-44 shrink-0 font-semibold text-slate-600">{label}</span>
      <span className="text-slate-900">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 border-b border-slate-300 pb-1 text-xs font-bold uppercase tracking-wider text-slate-700">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function PrintReport() {
  const { id } = useParams();
  const studyId = Number(id);
  const { data: study, isLoading } = useQuery({
    queryKey: ["study", studyId],
    queryFn: () => api.getStudy(studyId),
  });
  const { data: comparison } = useQuery({
    queryKey: ["comparison", studyId],
    queryFn: () => api.getComparison(studyId),
  });

  if (isLoading)
    return <p className="p-8 text-slate-500">Loading report…</p>;
  if (!study) return <p className="p-8 text-slate-500">Study not found.</p>;

  const c = study.clinical;
  const r = study.report;
  const generated = new Date().toLocaleString();

  return (
    <div className="min-h-screen bg-slate-200 py-6 print:bg-white print:py-0">
      {/* toolbar (not printed) */}
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between px-2 print:hidden">
        <a href={`/study/${study.id}`} className="text-sm text-slate-600 hover:text-slate-900">
          ← Back to study
        </a>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          <Printer size={16} /> Print / Save as PDF
        </button>
      </div>

      {/* document */}
      <div className="mx-auto max-w-3xl bg-white p-8 text-slate-900 shadow print:max-w-none print:p-0 print:shadow-none">
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <SnakeMark size={28} className="text-teal-600" />
            <div>
              <div className="text-2xl font-extrabold tracking-tight">
                ska<span className="text-teal-600">Nova</span>
              </div>
              <div className="text-xs text-slate-500">
                AI Diagnostic Imaging Report
              </div>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>Report #{study.id}</div>
            <div>Generated {generated}</div>
          </div>
        </div>

        <Section title="Patient & Study">
          <Row label="Patient" value={study.patient.name} />
          <Row label="Patient ID" value={study.patient.id} />
          <Row label="Age / Sex" value={`${study.patient.age} / ${study.patient.sex}`} />
          <Row
            label="Study"
            value={`${study.modality}${study.region ? " · " + study.region : ""}`}
          />
          <Row
            label="Acquired"
            value={new Date(study.uploaded_at).toLocaleString()}
          />
          <Row
            label="AI pipeline"
            value={
              study.analysis_source === "vision"
                ? "Claude vision (any modality)"
                : "torchxrayvision chest model + Grad-CAM"
            }
          />
        </Section>

        {c?.provided && (
          <Section title="Clinical Context">
            <Row label="Symptoms" value={c.symptoms} />
            <Row
              label="Temperature"
              value={c.temperature > 0 ? `${c.temperature.toFixed(1)} °C` : ""}
            />
            <Row label="SpO₂" value={c.spo2 > 0 ? `${c.spo2} %` : ""} />
            <Row label="Smoker" value={c.smoker ? "Yes" : ""} />
            {c.factors.length > 0 && (
              <Row label="Risk factors" value={c.factors.join("; ")} />
            )}
          </Section>
        )}

        <Section title="Risk Assessment">
          <Row
            label="Risk score"
            value={`${study.risk_score} / 100 — ${study.risk_band}`}
          />
          {c?.provided && c.adjustment > 0 && (
            <Row
              label="Breakdown"
              value={`${study.risk_base ?? study.risk_score} imaging + ${
                c.adjustment
              } clinical${
                (study.risk_base ?? study.risk_score) + c.adjustment > 100
                  ? " (capped at 100)"
                  : ""
              }`}
            />
          )}
          <Row label="Primary driver" value={study.top_finding} />
        </Section>

        {study.confidence && (
          <Section title="AI Confidence">
            <Row
              label="Confidence"
              value={`${study.confidence.score}% — ${study.confidence.band}`}
            />
            <Row
              label="Recommendation"
              value={
                study.confidence.double_check
                  ? "Radiologist double-check recommended"
                  : "AI is confident in this analysis"
              }
            />
            <Row label="Note" value={study.confidence.note} />
          </Section>
        )}

        <Section title="Findings (AI confidence)">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs text-slate-500">
                <th className="py-1">Finding</th>
                <th className="py-1">Severity</th>
                <th className="py-1 text-right">Confidence</th>
                <th className="py-1 text-right">Pop. baseline</th>
              </tr>
            </thead>
            <tbody>
              {study.findings.map((f) => (
                <tr key={f.pathology} className="border-b border-slate-100">
                  <td className="py-1">{f.pathology}</td>
                  <td className="py-1 capitalize">{f.severity ?? "—"}</td>
                  <td className="py-1 text-right tabular-nums">
                    {Math.round(f.probability * 100)}%
                  </td>
                  <td className="py-1 text-right tabular-nums text-slate-500">
                    {f.population_rate != null
                      ? `${Math.round(f.population_rate * 100)}%`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Impression & Recommendation (English)">
          <p className="text-sm leading-relaxed">
            <span className="font-semibold">Impression. </span>
            {r.impression_en || "—"}
          </p>
          <p className="mt-1 text-sm leading-relaxed">
            <span className="font-semibold">Recommendation. </span>
            {r.recommendation_en || "—"}
          </p>
        </Section>

        <Section title="Përshtypja & Rekomandimi (Shqip)">
          <p className="text-sm leading-relaxed">
            <span className="font-semibold">Përshtypja. </span>
            {r.impression_sq || "—"}
          </p>
          <p className="mt-1 text-sm leading-relaxed">
            <span className="font-semibold">Rekomandimi. </span>
            {r.recommendation_sq || "—"}
          </p>
        </Section>

        {comparison?.has_prior && (
          <Section title="Prior Comparison">
            <Row
              label="Risk change"
              value={`${comparison.prior_score} → ${comparison.current_score} (Δ${
                (comparison.delta ?? 0) >= 0 ? "+" : ""
              }${comparison.delta})`}
            />
            <p className="mt-1 text-sm">{comparison.summary_en}</p>
          </Section>
        )}

        <Section title="PACS Archive">
          <Row
            label="Status"
            value={study.pacs.archived ? "Archived in Orthanc PACS" : "Pending"}
          />
          <Row
            label="StudyInstanceUID"
            value={
              <span className="break-all font-mono text-xs">
                {study.pacs.study_instance_uid || "—"}
              </span>
            }
          />
        </Section>

        <Section title="Image">
          <img
            src={api.imageUrl(study, "original")}
            alt="study"
            className="max-h-80 rounded border border-slate-300"
          />
        </Section>

        <p className="mt-6 border-t border-slate-300 pt-3 text-xs text-slate-500">
          AI decision support — not a definitive diagnosis. For clinician review.
          Generated by skaNova.
        </p>
      </div>
    </div>
  );
}
