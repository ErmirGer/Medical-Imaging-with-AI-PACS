import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Database,
  Sparkles,
  ShieldAlert,
  ListChecks,
  Layers,
  TriangleAlert,
  Gauge,
  ChevronRight,
} from "lucide-react";
import { api } from "../api";
import RiskBadge from "../components/RiskBadge";
import ClinicalSignals from "../components/ClinicalSignals";
import PageHero from "../components/PageHero";
import StatCard from "../components/StatCard";
import { useAuth } from "../store";
import type { Study } from "../types";

export default function Worklist() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const isDoctor = useAuth((s) => s.account?.role === "doctor");
  const { data: studies, isLoading } = useQuery({
    queryKey: ["studies"],
    queryFn: () => api.listStudies("risk"),
    refetchInterval: 5000,
  });

  const seed = useMutation({
    mutationFn: () => api.seed(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studies"] }),
  });

  const list = studies ?? [];
  const total = list.length;
  const highRisk = list.filter((s) => s.risk_band === "High").length;
  const archived = list.filter((s) => s.pacs.archived).length;
  const avgConf = total
    ? Math.round(
        list.reduce((a, s) => a + (s.confidence?.score ?? 0), 0) / total,
      )
    : 0;

  return (
    <div>
      <PageHero
        icon={<ListChecks size={22} />}
        title={isDoctor ? "Worklist" : "My Scans"}
        subtitle={
          isDoctor
            ? "Your patients, auto-sorted by AI risk score"
            : "Your imaging studies and reports"
        }
        right={
          isDoctor && (
            <button
              onClick={() => seed.mutate()}
              disabled={seed.isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-edge bg-surface/70 px-3.5 py-2 text-sm font-medium text-slate-200 transition hover:border-accent/50 hover:text-white disabled:opacity-50"
            >
              <Sparkles size={16} className="text-accent" />
              {seed.isPending ? "Seeding…" : "Load demo cases"}
            </button>
          )
        }
      />

      {/* stat row */}
      {total > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={<Layers size={18} />} value={total} label="Studies" tone="teal" />
          <StatCard
            icon={<TriangleAlert size={18} />}
            value={highRisk}
            label="High risk"
            tone="red"
          />
          <StatCard
            icon={<Gauge size={18} />}
            value={`${avgConf}%`}
            label="Avg AI confidence"
            tone="green"
          />
          <StatCard
            icon={<Database size={18} />}
            value={archived}
            label="Archived in PACS"
            tone="slate"
          />
        </div>
      )}

      {isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : !total ? (
        <div className="rounded-2xl border border-dashed border-edge p-12 text-center text-slate-500">
          {isDoctor
            ? "No studies yet. Upload a scan or load demo cases."
            : "No scans on file yet. Your studies will appear here once a doctor uploads them."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-edge edge-hl shadow-soft glass">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-panel to-surface text-left text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3 font-semibold">Patient</th>
                <th className="px-5 py-3 font-semibold">Top finding</th>
                <th className="px-5 py-3 font-semibold">Signals</th>
                <th className="px-5 py-3 font-semibold">Risk</th>
                <th className="px-5 py-3 font-semibold">PACS</th>
                <th className="px-5 py-3 font-semibold">Uploaded</th>
                <th className="px-2"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((s: Study) => {
                const bar =
                  s.risk_band === "High"
                    ? "before:bg-high"
                    : s.risk_band === "Medium"
                    ? "before:bg-medium"
                    : "before:bg-low";
                return (
                  <tr
                    key={s.id}
                    onClick={() => nav(`/study/${s.id}`)}
                    className={`group relative cursor-pointer border-t border-edge/70 transition hover:bg-accent/[0.06] before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:content-[''] before:opacity-0 before:transition hover:before:opacity-100 ${bar}`}
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-slate-100">
                        {s.patient.name}
                      </span>
                      <div className="text-xs text-slate-500">
                        {s.patient.id} · {s.patient.age}/{s.patient.sex} · {s.modality}
                        {s.region ? ` ${s.region}` : ""}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">{s.top_finding}</td>
                    <td className="px-5 py-3.5">
                      <ClinicalSignals clinical={s.clinical} size="xs" />
                    </td>
                    <td className="px-5 py-3.5">
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
                    <td className="px-5 py-3.5">
                      {s.pacs.archived ? (
                        <span className="inline-flex items-center gap-1 text-xs text-low">
                          <Database size={13} /> Archived
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      {new Date(s.uploaded_at).toLocaleString()}
                    </td>
                    <td className="pr-3 text-slate-600">
                      <ChevronRight
                        size={16}
                        className="opacity-0 transition group-hover:translate-x-0.5 group-hover:text-accent group-hover:opacity-100"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
