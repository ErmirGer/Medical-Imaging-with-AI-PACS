import { AlertTriangle, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { AlertEvent } from "../types";

export default function AlertToast({
  alert,
  onClose,
}: {
  alert: AlertEvent;
  onClose: () => void;
}) {
  const nav = useNavigate();
  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 animate-[slidein_0.3s_ease] rounded-xl border border-high/50 bg-[#1a0e12] p-4 shadow-2xl shadow-high/20">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-high/20 p-2">
          <AlertTriangle className="text-high" size={20} />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-high">HIGH-RISK ALERT</span>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
              <X size={16} />
            </button>
          </div>
          <p className="mt-1 text-sm text-slate-200">
            {alert.patient} — <b>{alert.driver}</b> (risk {alert.score})
          </p>
          <p className="text-xs text-slate-400">Routed to {alert.department}</p>
          <button
            onClick={() => {
              nav(`/study/${alert.study_id}`);
              onClose();
            }}
            className="mt-2 rounded-lg bg-high/20 px-3 py-1 text-xs font-semibold text-high ring-1 ring-high/40 hover:bg-high/30"
          >
            Open study →
          </button>
        </div>
      </div>
    </div>
  );
}
