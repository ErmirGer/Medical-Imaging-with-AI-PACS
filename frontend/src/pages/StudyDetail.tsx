import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Database, ShieldCheck } from "lucide-react";
import { api } from "../api";
import Viewer from "../components/Viewer";
import RiskBadge from "../components/RiskBadge";
import FindingsList from "../components/FindingsList";
import ReportPanel from "../components/ReportPanel";

export default function StudyDetail() {
  const { id } = useParams();
  const studyId = Number(id);
  const { data: study, isLoading } = useQuery({
    queryKey: ["study", studyId],
    queryFn: () => api.getStudy(studyId),
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

          <ReportPanel report={study.report} />
        </div>
      </div>
    </div>
  );
}
