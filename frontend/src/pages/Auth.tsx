import { useState } from "react";
import { Activity, Stethoscope, User, Loader2, AlertTriangle } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../store";
import type { AccountRole } from "../types";

export default function Auth() {
  const setAuth = useAuth((s) => s.setAuth);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [role, setRole] = useState<AccountRole>("doctor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [personalNumber, setPersonalNumber] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("Radiology");
  const [patientId, setPatientId] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res =
        mode === "login"
          ? await api.login(personalNumber.trim(), password)
          : await api.signup({
              personal_number: personalNumber.trim(),
              password,
              role,
              name: name.trim(),
              ...(role === "doctor"
                ? { department }
                : {
                    patient_id: patientId.trim() || undefined,
                    age: age ? Number(age) : undefined,
                    sex: sex || undefined,
                  }),
            });
      setAuth(res.token, res.account);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function demo(kind: "doctor" | "patient") {
    setMode("login");
    setPersonalNumber(kind === "doctor" ? "1234567890" : "9876543210");
    setPassword("demo1234");
  }

  const field =
    "w-full rounded-lg border border-edge bg-panel/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accent focus:outline-none";
  const label = "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400";

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="rounded-lg bg-accent/20 p-2">
            <Activity className="text-accent" size={24} />
          </div>
          <span className="text-2xl font-extrabold tracking-tight">
            Rad<span className="text-accent">Guard</span>
          </span>
        </div>

        <div className="rounded-2xl border border-edge bg-panel/60 p-6">
          {/* login/signup toggle */}
          <div className="mb-5 flex overflow-hidden rounded-lg border border-edge text-sm">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`flex-1 py-2 font-medium ${
                  mode === m ? "bg-accent/20 text-accent" : "text-slate-400"
                }`}
              >
                {m === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>

          {/* role selector (signup only) */}
          {mode === "signup" && (
            <div className="mb-4 grid grid-cols-2 gap-2">
              {(
                [
                  { id: "doctor", label: "Doctor", icon: Stethoscope },
                  { id: "patient", label: "Patient", icon: User },
                ] as const
              ).map((r) => {
                const Icon = r.icon;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition ${
                      role === r.id
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-edge bg-panel/60 text-slate-300 hover:border-accent/50"
                    }`}
                  >
                    <Icon size={16} /> {r.label}
                  </button>
                );
              })}
            </div>
          )}

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <label className={label}>Full name</label>
                <input
                  className={field}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={role === "doctor" ? "Dr. Jane Doe" : "Your name"}
                />
              </div>
            )}

            <div>
              <label className={label}>Personal number</label>
              <input
                className={field}
                type="text"
                value={personalNumber}
                onChange={(e) => setPersonalNumber(e.target.value)}
                placeholder="e.g. 1234567890"
                required
              />
            </div>
            <div>
              <label className={label}>Password</label>
              <input
                className={field}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {mode === "signup" && role === "doctor" && (
              <div>
                <label className={label}>Department</label>
                <select
                  className={field}
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  <option>Radiology</option>
                  <option>Emergency</option>
                  <option>Cardiology</option>
                  <option>Surgery</option>
                </select>
              </div>
            )}

            {mode === "signup" && role === "patient" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={label}>Patient ID (MRN)</label>
                  <input
                    className={field}
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    placeholder="e.g. P-001 (links to your records)"
                  />
                </div>
                <div>
                  <label className={label}>Age</label>
                  <input
                    className={field}
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                  />
                </div>
                <div>
                  <label className={label}>Sex</label>
                  <select
                    className={field}
                    value={sex}
                    onChange={(e) => setSex(e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="O">Other</option>
                  </select>
                </div>
              </div>
            )}

            {error && (
              <p className="flex items-start gap-2 rounded-lg border border-high/40 bg-high/10 px-3 py-2 text-sm text-high">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-accent/90 disabled:opacity-60"
            >
              {busy && <Loader2 className="animate-spin" size={16} />}
              {mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>

          <div className="mt-5 border-t border-edge pt-4 text-center text-xs text-slate-500">
            Try a demo account:
            <div className="mt-2 flex justify-center gap-2">
              <button
                onClick={() => demo("doctor")}
                className="rounded-lg border border-edge px-3 py-1.5 text-slate-300 hover:text-slate-100"
              >
                Doctor
              </button>
              <button
                onClick={() => demo("patient")}
                className="rounded-lg border border-edge px-3 py-1.5 text-slate-300 hover:text-slate-100"
              >
                Patient
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
