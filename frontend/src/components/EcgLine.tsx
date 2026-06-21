export default function EcgLine({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 40"
      preserveAspectRatio="none"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M0 20 H110 l9 -13 l11 26 l10 -22 l8 9 H210 l7 -7 l9 14 l8 -10 H400" />
    </svg>
  );
}
