import { useState } from "react";
import { Layers, Eye } from "lucide-react";
import type { Study } from "../types";
import { api } from "../api";

export default function Viewer({ study }: { study: Study }) {
  const hasHeatmap = study.heatmap_available ?? true;
  const [showHeat, setShowHeat] = useState(hasHeatmap);
  const [opacity, setOpacity] = useState(0.85);
  const original = api.imageUrl(study, "original");
  const heatmap = api.imageUrl(study, "heatmap");
  const label = [study.modality, study.region, study.patient.name]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-xl border border-edge bg-black/60 overflow-hidden">
      <div className="relative aspect-square w-full bg-black">
        <img
          src={original}
          alt="medical image"
          className="absolute inset-0 h-full w-full object-contain"
        />
        {hasHeatmap && showHeat && (
          <img
            src={heatmap}
            alt="grad-cam heatmap"
            style={{ opacity }}
            className="absolute inset-0 h-full w-full object-contain transition-opacity"
          />
        )}
        <div className="absolute left-3 top-3 rounded bg-black/60 px-2 py-1 text-xs text-slate-300">
          {label}
        </div>
        {study.analysis_source === "vision" && (
          <div className="absolute right-3 top-3 rounded bg-accent/20 px-2 py-1 text-xs text-accent ring-1 ring-accent/40">
            AI vision analysis
          </div>
        )}
      </div>

      {hasHeatmap ? (
        <div className="flex items-center gap-4 border-t border-edge bg-panel px-4 py-3">
          <button
            onClick={() => setShowHeat((s) => !s)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              showHeat
                ? "bg-accent/20 text-accent ring-1 ring-accent/40"
                : "bg-slate-700/40 text-slate-300"
            }`}
          >
            {showHeat ? <Layers size={16} /> : <Eye size={16} />}
            {showHeat ? "Heatmap on" : "Heatmap off"}
          </button>
          <div className="flex flex-1 items-center gap-2">
            <span className="text-xs text-slate-400">Opacity</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={opacity}
              disabled={!showHeat}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="flex-1 accent-accent"
            />
          </div>
        </div>
      ) : (
        <div className="border-t border-edge bg-panel px-4 py-3 text-xs text-slate-500">
          Grad-CAM localization is available for chest X-ray. This{" "}
          {study.modality}
          {study.region ? ` (${study.region})` : ""} study was analyzed by AI
          vision.
        </div>
      )}
    </div>
  );
}
