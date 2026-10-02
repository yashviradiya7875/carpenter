import { cx } from '../utils/cx'
import './Spinner.css'

export type SpinnerSize = 'sm' | 'md' | 'lg'

export type SpinnerProps = {
  size?: SpinnerSize
  /** Announced to assistive technology. Omit when surrounding text already says what is loading. */
  label?: string
  className?: string
}

export function Spinner({ size = 'md', label, className }: SpinnerProps) {
  return (
    <span className={cx('app-spinner', `app-spinner--${size}`, className)} role={label ? 'status' : undefined}>
      <span className="app-spinner-ring" aria-hidden="true" />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  )
}
