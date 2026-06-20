interface Props {
  score: number;
  band: "High" | "Medium" | "Low";
  size?: "sm" | "lg";
}

const STYLES: Record<string, string> = {
  High: "bg-high/15 text-high ring-high/40",
  Medium: "bg-medium/15 text-medium ring-medium/40",
  Low: "bg-low/15 text-low ring-low/40",
};

export default function RiskBadge({ score, band, size = "sm" }: Props) {
  const lg = size === "lg";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full ring-1 font-semibold ${
        STYLES[band]
      } ${lg ? "px-4 py-1.5 text-base" : "px-2.5 py-0.5 text-xs"}`}
    >
      <span
        className={`rounded-full ${
          band === "High"
            ? "bg-high"
            : band === "Medium"
            ? "bg-medium"
            : "bg-low"
        } ${lg ? "h-2.5 w-2.5" : "h-2 w-2"} ${
          band === "High" ? "animate-pulse" : ""
        }`}
      />
      {score} · {band}
    </span>
  );
}
