export default function DataSourceBadge({ source = "assumed", confidence }) {
  const isReal = source === "real";
  const isOverride = source === "override";
  const label = isOverride ? "User override" : isReal ? "Real data" : "Assumed";
  const badgeStyle = isOverride
    ? "bg-qu-maroon/10 text-qu-maroon"
    : isReal
      ? "bg-qu-success/10 text-qu-success"
      : "bg-qu-warning/10 text-qu-warning";
  const dotStyle = isOverride
    ? "bg-qu-maroon"
    : isReal
      ? "bg-qu-success"
      : "bg-qu-warning";

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${badgeStyle}`}
      title={confidence ? `Confidence: ${confidence}` : undefined}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotStyle}`} />
      {label}
    </span>
  );
}
