import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UploadCloud, Loader2, Activity, X, AlertTriangle } from "lucide-react";
import { api, type UploadMeta } from "../api";

const MODALITIES = [
  { id: "DX", label: "X-ray" },
  { id: "CT", label: "CT" },
  { id: "MR", label: "MRI" },
  { id: "US", label: "Ultrasound" },
];

export default function Upload() {
  const nav = useNavigate();
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // selected file (NOT uploaded until the user clicks Analyze)
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // patient + acquisition
  const [modality, setModality] = useState("DX");
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");

  // clinical context
  const [symptoms, setSymptoms] = useState("");
  const [temperature, setTemperature] = useState("");
  const [spo2, setSpo2] = useState("");
  const [smoker, setSmoker] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function selectFile(f: File) {
    setError(null);
    setFile(f);
  }

  const missing: string[] = [];
  if (!patientName.trim()) missing.push("name");
  if (!age || Number(age) <= 0) missing.push("age");
  if (!sex) missing.push("sex");
  const canAnalyze = !!file && missing.length === 0 && !busy;

  async function analyze() {
    if (!file) {
      setError("Select an image first.");
      return;
    }
    if (missing.length) {
      setError(`Patient ${missing.join(", ")} required before analysis.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const meta: UploadMeta = {
        modality,
        patientId: patientId.trim() || undefined,
        patientName: patientName.trim(),
        age: Number(age),
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
  const req = (k: string) =>
    missing.includes(k) ? "border-high/50" : "";

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">New study</h1>
      <p className="mb-6 text-sm text-slate-400">
        Enter the patient details, attach an image, then run the analysis. The
        image is analyzed, scored, archived to PACS, and reported automatically.
      </p>

      {/* Modality */}
      <div className="mb-5">
        <span className={labelCls}>Modality</span>
        <div className="flex flex-wrap gap-2">
          {MODALITIES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModality(m.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                modality === m.id
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-edge bg-panel/60 text-slate-300 hover:border-accent/50"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          AI vision reads any modality and body region; chest X-ray also gets a
          Grad-CAM heatmap.
        </p>
      </div>

      {/* Patient (required) */}
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>
            Patient name <span className="text-high">*</span>
          </label>
          <input
            className={`${field} ${req("name")}`}
            placeholder="e.g. Ardit Krasniqi"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Patient ID</label>
          <input
            className={field}
            placeholder="e.g. MRN-001 (optional)"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Use a unique ID to tell apart patients with the same name, age &amp;
            sex. Reusing an ID groups their studies together.
          </p>
        </div>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>
            Age <span className="text-high">*</span>
          </label>
          <input
            className={`${field} ${req("age")}`}
            type="number"
            placeholder="54"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>
            Sex <span className="text-high">*</span>
          </label>
          <select
            className={`${field} ${req("sex")}`}
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

      {/* Image select (does NOT auto-start) */}
      {!file ? (
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
            if (f) selectFile(f);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed py-16 transition ${
            drag ? "border-accent bg-accent/5" : "border-edge bg-panel/40"
          }`}
        >
          <UploadCloud className="mb-3 text-accent" size={40} />
          <p className="font-medium text-slate-200">
            Drag &amp; drop or click to select
          </p>
          <p className="text-sm text-slate-500">Medical image (PNG / JPG)</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) selectFile(f);
            }}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-edge bg-panel/40 p-4">
          <div className="flex items-center gap-4">
            {preview && (
              <img
                src={preview}
                alt="selected"
                className="h-20 w-20 rounded-lg border border-edge object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-100">
                {file.name}
              </p>
              <p className="text-xs text-slate-500">
                {(file.size / 1024).toFixed(0)} KB · ready to analyze
              </p>
            </div>
            <button
              onClick={() => setFile(null)}
              disabled={busy}
              className="rounded-lg border border-edge p-2 text-slate-400 hover:text-slate-200 disabled:opacity-50"
              title="Remove"
            >
              <X size={16} />
            </button>
          </div>

          <button
            onClick={analyze}
            disabled={!canAnalyze}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-slate-700/50 disabled:text-slate-500"
          >
            {busy ? (
              <>
                <Loader2 className="animate-spin" size={18} /> Running AI
                pipeline… (inference · heatmap · PACS · report)
              </>
            ) : (
              "Run analysis"
            )}
          </button>
          {!busy && missing.length > 0 && (
            <p className="mt-2 text-center text-xs text-slate-500">
              Enter patient {missing.join(", ")} to enable analysis.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-high/40 bg-high/10 px-4 py-3 text-sm text-high">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
