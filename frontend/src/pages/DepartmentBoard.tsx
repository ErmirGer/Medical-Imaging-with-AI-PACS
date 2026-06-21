import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, LayoutGrid, ArrowRight } from "lucide-react";
import { api } from "../api";
import { useRole, ROLE_LABELS } from "../store";
import { useAlerts } from "../useAlerts";
import RiskBadge from "../components/RiskBadge";
import PageHero from "../components/PageHero";
import type { Study } from "../types";

const DEPT_BY_ROLE: Record<string, string> = {
  radiologist: "radiology",
  emergency: "emergency",
  cardiology: "cardiology",
  surgery: "surgery",
};

export default function DepartmentBoard() {
  const { role } = useRole();
  const dept = DEPT_BY_ROLE[role];
  const qc = useQueryClient();

  const { data: studies, isLoading } = useQuery({
    queryKey: ["queue", dept],
    queryFn: () => api.departmentQueue(dept),
    refetchInterval: 4000,
  });

  // refetch immediately when a high-risk alert lands
  const { latest } = useAlerts();
  useEffect(() => {
    if (latest) qc.invalidateQueries({ queryKey: ["queue", dept] });
  }, [latest, dept, qc]);

  async function ack(id: number) {
    await api.ack(id);
    qc.invalidateQueries({ queryKey: ["queue", dept] });
  }

  return (
    <div>
      <PageHero
        icon={<LayoutGrid size={22} />}
        title={`${ROLE_LABELS[role]} Board`}
        subtitle="Cross-departmental queue · live high-risk routing"
      />

      {isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : !studies?.length ? (
        <div className="rounded-2xl border border-dashed border-edge p-12 text-center text-slate-500">
          No cases routed to {ROLE_LABELS[role]} yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {studies.map((s: Study) => {
            const accent =
              s.risk_band === "High"
                ? "before:bg-high"
                : s.risk_band === "Medium"
                ? "before:bg-medium"
                : "before:bg-low";
            return (
              <Link
                to={`/study/${s.id}`}
                key={s.id}
                className={`group lift relative block overflow-hidden rounded-2xl border border-edge glass edge-hl p-5 hover:border-accent/40 hover:shadow-soft before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:content-[''] ${accent}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-100 group-hover:text-accent">
                      {s.patient.name}
                    </div>
                    <p className="text-xs text-slate-500">
                      {s.patient.id} · {s.patient.age}/{s.patient.sex} · {s.modality}
                    </p>
                  </div>
                  <RiskBadge score={s.risk_score} band={s.risk_band} />
                </div>

                <p className="mt-3 text-sm text-slate-300">
                  Driver: <b className="text-slate-100">{s.top_finding}</b>
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-edge/70 pt-3">
                  {s.alert && s.alert.sent ? (
                    s.alert.acknowledged ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-low">
                        <CheckCircle2 size={14} /> Acknowledged
                      </span>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-high">
                          <AlertTriangle size={14} className="animate-pulse" /> Alert active
                        </span>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            ack(s.id);
                          }}
                          className="rounded-lg bg-high/20 px-3 py-1 text-xs font-semibold text-high ring-1 ring-high/40 transition hover:bg-high/30"
                        >
                          Acknowledge
                        </button>
                      </>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 transition group-hover:text-accent">
                      Open study <ArrowRight size={13} />
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
