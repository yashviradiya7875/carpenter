import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../utils/cx'
import './TopBar.css'

export type TopBarProps = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  /** Leading content, typically the product brand. */
  start: ReactNode
  /** Trailing actions. */
  end?: ReactNode
  /** Keeps the bar at the top of its scroll container. */
  sticky?: boolean
  className?: string
}

/** Application header bar: brand at the start, actions at the end. */
export function TopBar({ start, end, sticky = false, className, ...props }: TopBarProps) {
  return (
    <header {...props} className={cx('app-topbar', sticky && 'app-topbar--sticky', className)}>
      <div className="app-topbar-start">{start}</div>
      {end ? <div className="app-topbar-end">{end}</div> : null}
    </header>
  )
}
