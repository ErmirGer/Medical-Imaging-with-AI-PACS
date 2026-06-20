import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { api } from "../api";
import { useRole, ROLE_LABELS } from "../store";
import { useAlerts } from "../useAlerts";
import RiskBadge from "../components/RiskBadge";
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
      <div className="mb-5">
        <h1 className="text-2xl font-bold">{ROLE_LABELS[role]} Board</h1>
        <p className="text-sm text-slate-400">
          Cross-departmental queue · live high-risk routing
        </p>
      </div>

      {isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : !studies?.length ? (
        <div className="rounded-xl border border-dashed border-edge p-12 text-center text-slate-500">
          No cases routed to {ROLE_LABELS[role]} yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {studies.map((s: Study) => (
            <div
              key={s.id}
              className={`rounded-xl border bg-panel p-4 ${
                s.risk_band === "High" ? "border-high/50" : "border-edge"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <Link
                    to={`/study/${s.id}`}
                    className="font-semibold text-slate-100 hover:text-accent"
                  >
                    {s.patient.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {s.patient.id} · {s.patient.age}/{s.patient.sex}
                  </p>
                </div>
                <RiskBadge score={s.risk_score} band={s.risk_band} />
              </div>

              <p className="mt-3 text-sm text-slate-300">
                Driver: <b>{s.top_finding}</b>
              </p>

              {s.alert && s.alert.sent && (
                <div className="mt-3 flex items-center justify-between border-t border-edge pt-3">
                  {s.alert.acknowledged ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-low">
                      <CheckCircle2 size={14} /> Acknowledged
                    </span>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1.5 text-xs text-high">
                        <AlertTriangle size={14} /> Alert active
                      </span>
                      <button
                        onClick={() => ack(s.id)}
                        className="rounded-lg bg-high/20 px-3 py-1 text-xs font-semibold text-high ring-1 ring-high/40 hover:bg-high/30"
                      >
                        Acknowledge
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
