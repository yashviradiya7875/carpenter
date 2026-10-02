export function OverviewStat({ label, value }: { label: string; value: string }) {
  return <div className="overview-stat"><span>{label}</span><strong>{value}</strong></div>
}
