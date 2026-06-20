import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
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
} from "lucide-react";
import { api } from "../api";
import Viewer from "../components/Viewer";
import RiskBadge from "../components/RiskBadge";
import FindingsList from "../components/FindingsList";
import ReportPanel from "../components/ReportPanel";
import PopulationChart from "../components/PopulationChart";

export default function StudyDetail() {
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

  if (isLoading) return <p className="text-slate-500">Loading study…</p>;
  if (!study) return <p className="text-slate-500">Study not found.</p>;

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
          </p>
        </div>
        <RiskBadge score={study.risk_score} band={study.risk_band} size="lg" />
      </div>

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
          <div className="rounded-xl border border-edge bg-panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Findings
              </h3>
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <ShieldCheck size={13} /> driver: {study.top_finding}
              </span>
            </div>
            <FindingsList findings={study.findings} />
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

          <ReportPanel report={study.report} />

          {comparison?.has_prior && (
            <div className="rounded-xl border border-edge bg-panel p-4">
              <div className="mb-2 flex items-center gap-2">
                {(comparison.delta ?? 0) >= 0 ? (
                  <TrendingUp size={16} className="text-high" />
                ) : (
                  <TrendingDown size={16} className="text-low" />
                )}
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Prior comparison
                </h3>
                <span className="ml-auto text-xs text-slate-500">
                  vs study #{comparison.prior_id}
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
              <p className="text-sm text-slate-300">{comparison.summary_en}</p>
              <p className="mt-1 text-xs text-slate-500">{comparison.summary_sq}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
