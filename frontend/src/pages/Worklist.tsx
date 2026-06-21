import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Database, Sparkles, ShieldAlert } from "lucide-react";
import { api } from "../api";
import RiskBadge from "../components/RiskBadge";
import ClinicalSignals from "../components/ClinicalSignals";
import type { Study } from "../types";

export default function Worklist() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: studies, isLoading } = useQuery({
    queryKey: ["studies"],
    queryFn: () => api.listStudies("risk"),
    refetchInterval: 5000,
  });

  const seed = useMutation({
    mutationFn: () => api.seed(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studies"] }),
  });

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Radiologist Worklist</h1>
          <p className="text-sm text-slate-400">Auto-sorted by AI risk score</p>
        </div>
        <button
          onClick={() => seed.mutate()}
          disabled={seed.isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-edge bg-panel px-3 py-2 text-sm text-slate-300 hover:text-slate-100 disabled:opacity-50"
        >
          <Sparkles size={16} />
          {seed.isPending ? "Seeding…" : "Load demo cases"}
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : !studies?.length ? (
        <div className="rounded-xl border border-dashed border-edge p-12 text-center text-slate-500">
          No studies yet. Upload an X-ray or load demo cases.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-edge">
          <table className="w-full text-sm">
            <thead className="bg-panel text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Top finding</th>
                <th className="px-4 py-3">Signals</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">PACS</th>
                <th className="px-4 py-3">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {studies.map((s: Study) => (
                <tr
                  key={s.id}
                  onClick={() => nav(`/study/${s.id}`)}
                  className="cursor-pointer border-t border-edge bg-surface/40 transition hover:bg-panel/60"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-100">
                      {s.patient.name}
                    </span>
                    <div className="text-xs text-slate-500">
                      {s.patient.id} · {s.patient.age}/{s.patient.sex}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{s.top_finding}</td>
                  <td className="px-4 py-3">
                    <ClinicalSignals clinical={s.clinical} size="xs" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <RiskBadge score={s.risk_score} band={s.risk_band} />
                      {s.confidence?.double_check && (
                        <span
                          title={`AI confidence ${s.confidence.score}% — double-check recommended`}
                          className="inline-flex items-center gap-1 rounded-md border border-medium/40 bg-medium/10 px-1.5 py-0.5 text-[10px] font-medium text-medium"
                        >
                          <ShieldAlert size={11} /> check
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {s.pacs.archived ? (
                      <span className="inline-flex items-center gap-1 text-xs text-low">
                        <Database size={13} /> Archived
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(s.uploaded_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
