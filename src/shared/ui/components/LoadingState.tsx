import type { ReactNode } from 'react'
import { cx } from '../utils/cx'
import { Spinner } from '../primitives/Spinner'
import './LoadingState.css'

export type LoadingStateProps = {
  /** Visible and announced, e.g. "Loading files…". */
  label: ReactNode
  /** Single row for panels, dialogs and lists instead of a centered block. */
  compact?: boolean
  className?: string
}

/** A spinner with a message, for content that is still loading. */
export function LoadingState({ label, compact = false, className }: LoadingStateProps) {
  return (
    <div className={cx('app-loading-state', compact && 'app-loading-state--compact', className)} role="status">
      <Spinner size={compact ? 'sm' : 'md'} />
      <span>{label}</span>
    </div>
  )
}
