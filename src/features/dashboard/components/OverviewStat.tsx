import { Skeleton } from '../../../shared/ui'

/** One figure of the overview. While it loads, a placeholder holds the place of the number. */
export function OverviewStat({ label, value, isLoading = false }: { label: string; value: string; isLoading?: boolean }) {
  return (
    <div className="overview-stat" aria-busy={isLoading || undefined}>
      <span>{label}</span>
      <strong>{isLoading ? <Skeleton variant="text" width={34} /> : value}</strong>
    </div>
  )
}
