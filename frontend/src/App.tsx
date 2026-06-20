import { useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Activity, LayoutGrid, ListChecks, Upload as UploadIcon, Radio } from "lucide-react";
import { useRole, ROLE_LABELS } from "./store";
import { useAlerts } from "./useAlerts";
import AlertToast from "./components/AlertToast";
import type { AlertEvent, Role } from "./types";
import Upload from "./pages/Upload";
import Worklist from "./pages/Worklist";
import StudyDetail from "./pages/StudyDetail";
import DepartmentBoard from "./pages/DepartmentBoard";

function NavLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  const loc = useLocation();
  const active = loc.pathname === to || (to !== "/" && loc.pathname.startsWith(to));
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active ? "bg-accent/15 text-accent" : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

export default function App() {
  const { role, setRole } = useRole();
  const [toast, setToast] = useState<AlertEvent | null>(null);
  const { connected } = useAlerts((e) => setToast(e));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-edge bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-6 py-3">
          <Link to="/" className="mr-4 flex items-center gap-2">
            <div className="rounded-lg bg-accent/20 p-1.5">
              <Activity className="text-accent" size={20} />
            </div>
            <span className="text-lg font-extrabold tracking-tight">
              Rad<span className="text-accent">Guard</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            <NavLink to="/" icon={<ListChecks size={16} />} label="Worklist" />
            <NavLink to="/upload" icon={<UploadIcon size={16} />} label="Upload" />
            <NavLink to="/board" icon={<LayoutGrid size={16} />} label="Dept Board" />
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <span
              className={`inline-flex items-center gap-1.5 text-xs ${
                connected ? "text-low" : "text-slate-500"
              }`}
              title="Live alert stream"
            >
              <Radio size={14} className={connected ? "animate-pulse" : ""} />
              {connected ? "Live" : "Offline"}
            </span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="rounded-lg border border-edge bg-panel px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <Routes>
          <Route path="/" element={<Worklist />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/study/:id" element={<StudyDetail />} />
          <Route path="/board" element={<DepartmentBoard />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      {toast && <AlertToast alert={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
