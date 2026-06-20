import { Thermometer, Wind, Cigarette } from "lucide-react";
import type { Clinical } from "../types";

/** Compact clinical-signal chips (fever / hypoxia / smoker) for dense rows. */
export default function ClinicalSignals({
  clinical,
  size = "sm",
}: {
  clinical?: Clinical | null;
  size?: "sm" | "xs";
}) {
  if (!clinical?.provided) return null;
  const chips: { key: string; label: string; icon: any; tone: string; title: string }[] = [];

  if (clinical.temperature >= 38) {
    chips.push({
      key: "fever",
      label: `${clinical.temperature.toFixed(1)}°`,
      icon: Thermometer,
      tone: "border-high/40 bg-high/10 text-high",
      title: `Fever ${clinical.temperature.toFixed(1)}°C`,
    });
  }
  if (clinical.spo2 > 0 && clinical.spo2 < 92) {
    chips.push({
      key: "hypoxia",
      label: `${clinical.spo2}%`,
      icon: Wind,
      tone: "border-high/40 bg-high/10 text-high",
      title: `Hypoxemia — SpO₂ ${clinical.spo2}%`,
    });
  } else if (clinical.spo2 >= 92 && clinical.spo2 < 95) {
    chips.push({
      key: "lowo2",
      label: `${clinical.spo2}%`,
      icon: Wind,
      tone: "border-medium/40 bg-medium/10 text-medium",
      title: `Borderline SpO₂ ${clinical.spo2}%`,
    });
  }
  if (clinical.smoker) {
    chips.push({
      key: "smoker",
      label: "Smoker",
      icon: Cigarette,
      tone: "border-edge bg-panel/60 text-slate-300",
      title: "Active smoker",
    });
  }

  if (chips.length === 0) return null;
  const pad = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";
  const ic = size === "xs" ? 10 : 12;

  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => {
        const Icon = c.icon;
        return (
          <span
            key={c.key}
            title={c.title}
            className={`inline-flex items-center gap-1 rounded-md border ${c.tone} ${pad}`}
          >
            <Icon size={ic} /> {c.label}
          </span>
        );
      })}
    </div>
  );
}
