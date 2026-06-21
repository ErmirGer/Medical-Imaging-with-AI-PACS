import { useRef, useState } from "react";
import { Layers, Eye, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import type { Study } from "../types";
import { api } from "../api";

const MIN = 1;
const MAX = 5;

export default function Viewer({ study }: { study: Study }) {
  const hasHeatmap = study.heatmap_available ?? true;
  const [showHeat, setShowHeat] = useState(hasHeatmap);
  const [opacity, setOpacity] = useState(0.85);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );

  const original = api.imageUrl(study, "original");
  const heatmap = api.imageUrl(study, "heatmap");
  const label = [study.modality, study.region, study.patient.name]
    .filter(Boolean)
    .join(" · ");

  function clampZoom(s: number) {
    return Math.min(MAX, Math.max(MIN, s));
  }
  function zoomTo(next: number) {
    const s = clampZoom(next);
    setScale(s);
    if (s === 1) setPos({ x: 0, y: 0 });
  }
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    zoomTo(scale + (e.deltaY < 0 ? 0.3 : -0.3));
  }
  function onDown(e: React.MouseEvent) {
    if (scale <= 1) return;
    drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  }
  function onMove(e: React.MouseEvent) {
    if (!drag.current) return;
    setPos({
      x: drag.current.px + (e.clientX - drag.current.x),
      y: drag.current.py + (e.clientY - drag.current.y),
    });
  }
  function endDrag() {
    drag.current = null;
  }

  return (
    <div className="rounded-2xl border border-edge edge-hl shadow-soft bg-black/60 overflow-hidden">
      <div
        className="relative aspect-square w-full select-none overflow-hidden bg-black"
        onWheel={onWheel}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        style={{ cursor: scale > 1 ? (drag.current ? "grabbing" : "grab") : "default" }}
      >
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: drag.current ? "none" : "transform 0.12s ease-out",
          }}
        >
          <img
            src={original}
            alt="medical image"
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain"
          />
          {hasHeatmap && showHeat && (
            <img
              src={heatmap}
              alt="grad-cam heatmap"
              draggable={false}
              style={{ opacity }}
              className="absolute inset-0 h-full w-full object-contain transition-opacity"
            />
          )}
        </div>

        <div className="pointer-events-none absolute left-3 top-3 rounded bg-black/60 px-2 py-1 text-xs text-slate-300">
          {label}
        </div>
        {study.analysis_source === "vision" && (
          <div className="pointer-events-none absolute right-3 top-3 rounded bg-accent/20 px-2 py-1 text-xs text-accent ring-1 ring-accent/40">
            AI vision analysis
          </div>
        )}

        {/* zoom controls */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg bg-black/60 p-1 backdrop-blur">
          <button
            onClick={() => zoomTo(scale - 0.4)}
            disabled={scale <= MIN}
            className="rounded p-1.5 text-slate-300 hover:bg-white/10 disabled:opacity-40"
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="w-9 text-center text-xs tabular-nums text-slate-400">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => zoomTo(scale + 0.4)}
            disabled={scale >= MAX}
            className="rounded p-1.5 text-slate-300 hover:bg-white/10 disabled:opacity-40"
            title="Zoom in"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => zoomTo(1)}
            disabled={scale === 1 && pos.x === 0 && pos.y === 0}
            className="rounded p-1.5 text-slate-300 hover:bg-white/10 disabled:opacity-40"
            title="Reset"
          >
            <Maximize2 size={16} />
          </button>
        </div>
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
          vision. Scroll or use the controls to zoom.
        </div>
      )}
    </div>
  );
}
