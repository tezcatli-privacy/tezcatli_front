type MetricBadgeProps = {
  label: string;
  value: string;
  tone?: "mint" | "gold" | "neutral";
};

export function MetricBadge({ label, value, tone = "mint" }: MetricBadgeProps) {
  return (
    <div className={`pds-metric-badge pds-metric-badge--${tone}`}>
      <span className="pds-metric-badge__label">{label}</span>
      <strong className="pds-metric-badge__value">{value}</strong>
    </div>
  );
}
