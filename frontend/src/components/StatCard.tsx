import type { ReactNode } from "react";

type Tone = "teal" | "red" | "amber" | "green" | "slate";

const TONE: Record<Tone, { ring: string; chip: string; glow: string }> = {
  teal: {
    ring: "border-accent/30",
    chip: "bg-accent/15 text-accent",
    glow: "bg-accent/15",
  },
  red: {
    ring: "border-high/30",
    chip: "bg-high/15 text-high",
    glow: "bg-high/15",
  },
  amber: {
    ring: "border-medium/30",
    chip: "bg-medium/15 text-medium",
    glow: "bg-medium/15",
  },
  green: {
    ring: "border-low/30",
    chip: "bg-low/15 text-low",
    glow: "bg-low/15",
  },
  slate: {
    ring: "border-edge",
    chip: "bg-white/5 text-slate-300",
    glow: "bg-white/5",
  },
};

export default function StatCard({
  icon,
  value,
  label,
  tone = "teal",
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  tone?: Tone;
}) {
  const t = TONE[tone];
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${t.ring} glass edge-hl p-4`}
    >
      <div
        className={`pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full blur-2xl ${t.glow}`}
      />
      <div className="relative flex items-center gap-3">
        <div className={`rounded-xl p-2.5 ${t.chip}`}>{icon}</div>
        <div>
          <div className="text-2xl font-bold tabular-nums tracking-tight text-slate-50">
            {value}
          </div>
          <div className="text-xs text-slate-400">{label}</div>
        </div>
      </div>
    </div>
  );
}
