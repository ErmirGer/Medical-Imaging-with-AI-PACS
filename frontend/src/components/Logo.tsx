// skaNova brand mark — a stylized serpent (the medical symbol), drawn as a clean
// S-curve that doubles as the brand's initial.

export function SnakeMark({
  size = 22,
  className = "text-white",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      {/* serpent body — an S curve */}
      <path
        d="M21 9 C 12 9, 12 15, 16 16 C 20 17, 20 23, 11 23"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* head */}
      <circle cx="21" cy="8.7" r="2.9" fill="currentColor" />
      {/* flicking forked tongue */}
      <path
        d="M23.6 8.2 L26 7 M26 7 L24.4 5.8 M26 7 L25.7 5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* eye */}
      <circle cx="21.6" cy="7.9" r="0.85" className="fill-ink" />
    </svg>
  );
}

export default function Logo({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex shrink-0 items-center justify-center rounded-2xl bg-brand-gradient shadow-accent-glow ${className}`}
      style={{ width: size, height: size }}
    >
      <SnakeMark size={Math.round(size * 0.6)} className="text-white" />
    </div>
  );
}
