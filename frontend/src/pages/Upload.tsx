import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { UploadCloud, Loader2 } from "lucide-react";
import { api } from "../api";

export default function Upload() {
  const nav = useNavigate();
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const study = await api.uploadStudy(file);
      nav(`/study/${study.id}`);
    } catch (e: any) {
      setError(e.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">Upload chest X-ray</h1>
      <p className="mb-6 text-sm text-slate-400">
        PNG or JPG. The image is analyzed, scored, archived to PACS, and reported
        automatically.
      </p>

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
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed py-20 transition ${
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
