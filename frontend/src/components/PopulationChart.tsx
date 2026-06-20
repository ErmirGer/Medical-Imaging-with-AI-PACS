import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import type { Finding } from "../types";

/**
 * Population reference comparison: each top finding's probability for THIS
 * patient vs the population baseline prevalence for that pathology. Makes the
 * "deviation from the normal cohort" explicit, per the challenge AI component.
 */
export default function PopulationChart({ findings }: { findings: Finding[] }) {
  const data = findings
    .filter((f) => f.population_rate != null)
    .slice(0, 5)
    .map((f) => ({
      name: f.pathology.length > 14 ? f.pathology.slice(0, 13) + "…" : f.pathology,
      patient: Math.round(f.probability * 100),
      population: Math.round((f.population_rate ?? 0) * 100),
    }));

  if (data.length === 0) return null;

  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Population reference
        </h3>
        <span className="text-xs text-slate-500">patient vs normal cohort</span>
      </div>
      <p className="mb-3 text-[11px] text-slate-500">
        How far each finding deviates from baseline prevalence in the reference
        population.
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            interval={0}
            angle={-12}
            textAnchor="end"
            height={42}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            unit="%"
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: number, n: string) => [
              `${v}%`,
              n === "patient" ? "This patient" : "Population",
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(v) => (v === "patient" ? "This patient" : "Population")}
          />
          <Bar dataKey="population" fill="#475569" radius={[3, 3, 0, 0]} />
          <Bar dataKey="patient" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={
                  d.patient >= 70
                    ? "#ef4444"
                    : d.patient >= 40
                    ? "#f59e0b"
                    : "#38bdf8"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
