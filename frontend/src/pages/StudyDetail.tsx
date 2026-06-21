import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Database,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Activity,
  Thermometer,
  Wind,
  Cigarette,
  Printer,
  Layers,
} from "lucide-react";
import { api } from "../api";
import Viewer from "../components/Viewer";
import RiskBadge from "../components/RiskBadge";
import FindingsList from "../components/FindingsList";
import ReportPanel from "../components/ReportPanel";
import PopulationChart from "../components/PopulationChart";
import ConfidenceCard from "../components/ConfidenceCard";
import type { Lang } from "../types";

export default function StudyDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const studyId = Number(id);
  const [lang, setLang] = useState<Lang>("en");
  const { data: study, isLoading } = useQuery({
    queryKey: ["study", studyId],
    queryFn: () => api.getStudy(studyId),
  });
  const { data: comparison } = useQuery({
    queryKey: ["comparison", studyId],
    queryFn: () => api.getComparison(studyId),
  });
  const { data: patientStudies } = useQuery({
    queryKey: ["patientStudies", study?.patient.id],
    queryFn: () => api.patientStudies(study!.patient.id),
    enabled: !!study,
  });

  if (isLoading) return <p className="text-slate-500">Loading study…</p>;
  if (!study) return <p className="text-slate-500">Study not found.</p>;

  const studies = patientStudies ?? [];

  return (
    <div>
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft size={15} /> Worklist
      </Link>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{study.patient.name}</h1>
          <p className="text-sm text-slate-400">
            {study.patient.id} · {study.patient.age}/{study.patient.sex} ·{" "}
            {study.modality}
            {study.region ? ` · ${study.region}` : ""}
          </p>
          {studies.length > 1 && (
            <div className="mt-2 inline-flex items-center gap-2">
              <Layers size={14} className="text-slate-500" />
              <span className="text-xs text-slate-500">
                {studies.length} {lang === "sq" ? "studime" : "studies"}:
              </span>
              <select
                value={studyId}
                onChange={(e) => nav(`/study/${e.target.value}`)}
                className="rounded-lg border border-edge bg-panel px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {studies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {new Date(s.uploaded_at).toLocaleString()} · {s.modality}
                    {s.region ? ` ${s.region}` : ""} · {s.risk_score} {s.risk_band}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.open(`/study/${studyId}/print`, "_blank")}
            className="inline-flex items-center gap-2 rounded-lg border border-edge bg-panel px-3 py-1.5 text-sm text-slate-300 hover:text-slate-100"
            title="Print full report"
          >
            <Printer size={15} /> {lang === "sq" ? "Printo" : "Print"}
          </button>
          <div className="flex overflow-hidden rounded-lg border border-edge text-xs">
            {(["en", "sq"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-3 py-1.5 font-medium ${
                  lang === l ? "bg-accent/20 text-accent" : "text-slate-400"
                }`}
              >
                {l === "en" ? "EN" : "SQ"}
              </button>
            ))}
          </div>
          <RiskBadge score={study.risk_score} band={study.risk_band} size="lg" />
        </div>
      </div>

      {(() => {
        const base = study.risk_base ?? study.risk_score;
        const adj = study.clinical?.adjustment ?? 0;
        if (adj <= 0) return null;
        const raw = base + adj;
        const capped = raw > 100;
        const basePct = (base / raw) * 100;
        const adjPct = (adj / raw) * 100;
        return (
          <div className="mb-5 rounded-xl border border-edge bg-panel p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold uppercase tracking-wide text-slate-400">
                Risk breakdown
              </span>
              <span className="text-slate-400">
                <span className="text-slate-200">{base}</span> imaging
                <span className="mx-1 text-slate-600">+</span>
                <span className="text-high">{adj}</span> clinical
                <span className="mx-1 text-slate-600">=</span>
                <span className="font-semibold text-slate-100">
                  {study.risk_score}
                </span>
                {capped && (
                  <span className="ml-1 text-xs text-slate-500">(capped 100)</span>
                )}
              </span>
            </div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-700/40">
              <div
                className="h-full bg-accent/70"
                style={{ width: `${basePct}%` }}
                title={`Imaging score: ${base}`}
              />
              <div
                className="h-full bg-high"
                style={{ width: `${adjPct}%` }}
                title={`Clinical fusion: +${adj}`}
              />
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Viewer study={study} />
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {study.pacs.archived ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-low/30 bg-low/10 px-3 py-1.5 text-low">
                <Database size={14} /> Archived in PACS
              </span>
            ) : (
              <span className="rounded-lg border border-edge bg-panel px-3 py-1.5 text-slate-400">
                PACS pending
              </span>
            )}
            {study.pacs.study_instance_uid && (
              <span className="truncate rounded-lg border border-edge bg-panel px-3 py-1.5 font-mono text-[11px] text-slate-400">
                UID {study.pacs.study_instance_uid}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {study.confidence && (
            <ConfidenceCard confidence={study.confidence} lang={lang} />
          )}

          <div className="rounded-xl border border-edge bg-panel p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                {lang === "sq" ? "Gjetjet" : "Findings"}
              </h3>
              <span className="inline-flex items-center gap-1 text-right text-xs text-slate-500">
                <ShieldCheck size={13} className="shrink-0" />
                {lang === "sq" ? "drejtues: " : "driver: "}
                {lang === "sq"
                  ? study.top_finding_sq || study.top_finding
                  : study.top_finding}
              </span>
            </div>
            <FindingsList findings={study.findings} lang={lang} />
          </div>

          <PopulationChart findings={study.findings} />

          {study.clinical?.provided && (
            <div className="rounded-xl border border-edge bg-panel p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                  <Activity size={14} className="text-accent" /> Clinical fusion
                </h3>
                {study.clinical.adjustment > 0 && (
                  <span className="rounded bg-high/15 px-2 py-0.5 text-xs font-semibold text-high">
                    +{study.clinical.adjustment} risk
                  </span>
                )}
              </div>

              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                {study.clinical.temperature > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-edge bg-panel/60 px-2.5 py-1 text-slate-300">
                    <Thermometer size={12} /> {study.clinical.temperature.toFixed(1)}°C
                  </span>
                )}
                {study.clinical.spo2 > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-edge bg-panel/60 px-2.5 py-1 text-slate-300">
                    <Wind size={12} /> SpO₂ {study.clinical.spo2}%
                  </span>
                )}
                {study.clinical.smoker && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-edge bg-panel/60 px-2.5 py-1 text-slate-300">
                    <Cigarette size={12} /> Smoker
                  </span>
                )}
              </div>

              {study.clinical.symptoms && (
                <p className="mb-3 text-sm text-slate-300">
                  <span className="text-slate-500">Symptoms: </span>
                  {study.clinical.symptoms}
                </p>
              )}

              {study.clinical.factors.length > 0 && (
                <ul className="space-y-1">
                  {study.clinical.factors.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm text-slate-300"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-high" />
                      {f}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <ReportPanel report={study.report} lang={lang} />

          {comparison?.has_prior && (
            <div className="rounded-xl border border-edge bg-panel p-4">
              <div className="mb-2 flex items-center gap-2">
                {(comparison.delta ?? 0) >= 0 ? (
                  <TrendingUp size={16} className="text-high" />
                ) : (
                  <TrendingDown size={16} className="text-low" />
                )}
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  {lang === "sq" ? "Krahasimi me studimin e mëparshëm" : "Prior comparison"}
                </h3>
                <span className="ml-auto text-xs text-slate-500">
                  {lang === "sq" ? "vs studimi" : "vs study"} #{comparison.prior_id}
                </span>
              </div>
              <div className="mb-3 flex items-center gap-3 text-sm">
                <span className="text-slate-400">
                  {comparison.prior_score}
                </span>
                <div className="h-1 flex-1 rounded-full bg-slate-700/50">
                  <div
                    className={`h-full rounded-full ${
                      (comparison.delta ?? 0) >= 0 ? "bg-high" : "bg-low"
                    }`}
                    style={{ width: `${comparison.current_score}%` }}
                  />
                </div>
                <span className="font-semibold text-slate-100">
                  {comparison.current_score}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                    (comparison.delta ?? 0) >= 0
                      ? "bg-high/15 text-high"
                      : "bg-low/15 text-low"
                  }`}
                >
                  Δ{(comparison.delta ?? 0) >= 0 ? "+" : ""}
                  {comparison.delta}
                </span>
              </div>
              <p className="text-sm text-slate-300">
                {lang === "sq" ? comparison.summary_sq : comparison.summary_en}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
