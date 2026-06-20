import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { UploadCloud, Loader2, Activity } from "lucide-react";
import { api, type UploadMeta } from "../api";

const MODALITIES = [
  { id: "DX", label: "X-ray", active: true },
  { id: "CT", label: "CT", active: false },
  { id: "MR", label: "MRI", active: false },
  { id: "US", label: "Ultrasound", active: false },
];

export default function Upload() {
  const nav = useNavigate();
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // patient + acquisition
  const [modality, setModality] = useState("DX");
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("U");

  // clinical context (fused into the risk score + report)
  const [symptoms, setSymptoms] = useState("");
  const [temperature, setTemperature] = useState("");
  const [spo2, setSpo2] = useState("");
  const [smoker, setSmoker] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const meta: UploadMeta = {
        modality,
        patientName: patientName.trim() || undefined,
        age: age ? Number(age) : undefined,
        sex,
        symptoms: symptoms.trim() || undefined,
        temperature: temperature ? Number(temperature) : undefined,
        spo2: spo2 ? Number(spo2) : undefined,
        smoker,
      };
      const study = await api.uploadStudy(file, meta);
      nav(`/study/${study.id}`);
    } catch (e: any) {
      setError(e.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-lg border border-edge bg-panel/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accent focus:outline-none";
  const labelCls =
    "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400";

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">New study</h1>
      <p className="mb-6 text-sm text-slate-400">
        The image is analyzed, scored, archived to PACS, and reported
        automatically. Clinical context is fused into the risk score.
      </p>

      {/* Modality */}
      <div className="mb-5">
        <span className={labelCls}>Modality</span>
        <div className="flex flex-wrap gap-2">
          {MODALITIES.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={!m.active}
              onClick={() => m.active && setModality(m.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                modality === m.id
                  ? "border-accent bg-accent/10 text-accent"
                  : m.active
                  ? "border-edge bg-panel/60 text-slate-300 hover:border-accent/50"
                  : "cursor-not-allowed border-edge/50 bg-panel/30 text-slate-600"
              }`}
            >
              {m.label}
              {!m.active && (
                <span className="ml-1 text-[10px] uppercase">soon</span>
              )}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          Chest X-ray is live; the same pipeline architecture generalizes to
          CT/MRI/US.
        </p>
      </div>

      {/* Patient */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <label className={labelCls}>Patient name</label>
          <input
            className={field}
            placeholder="Walk-in Patient"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Age</label>
          <input
            className={field}
            type="number"
            placeholder="50"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Sex</label>
          <select
            className={field}
            value={sex}
            onChange={(e) => setSex(e.target.value)}
          >
            <option value="U">—</option>
            <option value="M">M</option>
            <option value="F">F</option>
          </select>
        </div>
      </div>

      {/* Clinical context */}
      <div className="mb-6 rounded-xl border border-edge bg-panel/40 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Activity size={15} className="text-accent" /> Clinical context
          <span className="text-xs font-normal text-slate-500">
            (optional — fused into risk &amp; report)
          </span>
        </div>
        <div className="mb-3">
          <label className={labelCls}>Presenting symptoms</label>
          <input
            className={field}
            placeholder="e.g. productive cough, dyspnea, chest pain"
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Temp (°C)</label>
            <input
              className={field}
              type="number"
              step="0.1"
              placeholder="37.0"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>SpO₂ (%)</label>
            <input
              className={field}
              type="number"
              placeholder="98"
              value={spo2}
              onChange={(e) => setSpo2(e.target.value)}
            />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 accent-accent"
              checked={smoker}
              onChange={(e) => setSmoker(e.target.checked)}
            />
            Active smoker
          </label>
        </div>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed py-16 transition ${
          drag ? "border-accent bg-accent/5" : "border-edge bg-panel/40"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        {busy ? (
          <>
            <Loader2 className="mb-3 animate-spin text-accent" size={40} />
            <p className="font-medium text-slate-200">Running AI pipeline…</p>
            <p className="text-sm text-slate-500">
              inference · heatmap · PACS · report
            </p>
          </>
        ) : (
          <>
            <UploadCloud className="mb-3 text-accent" size={40} />
            <p className="font-medium text-slate-200">
              Drag &amp; drop or click to select
            </p>
            <p className="text-sm text-slate-500">Chest X-ray (PNG / JPG)</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-high/40 bg-high/10 px-4 py-2 text-sm text-high">
          {error}
        </p>
      )}
    </div>
  );
}
