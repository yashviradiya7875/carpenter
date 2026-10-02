import type { ReactNode } from 'react'
import { cx } from '../utils/cx'
import { Icon, type IconName } from '../primitives/Icon'
import './EmptyState.css'

export type EmptyStateProps = {
  icon?: IconName
  title: ReactNode
  description?: ReactNode
  /** Buttons or links for the next step. */
  actions?: ReactNode
  /** Tighter spacing for panels and dialogs. */
  compact?: boolean
  /** Heading level for the title, to fit the page outline. */
  headingLevel?: 1 | 2 | 3 | 4
  className?: string
}

export function EmptyState({ icon, title, description, actions, compact = false, headingLevel = 2, className }: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const

  return (
    <div className={cx('app-empty-state', compact && 'app-empty-state--compact', className)}>
      {icon ? <span className="app-empty-state-icon"><Icon name={icon} /></span> : null}
      <Heading className="app-empty-state-title">{title}</Heading>
      {description ? <p className="app-empty-state-description">{description}</p> : null}
      {actions ? <div className="app-empty-state-actions">{actions}</div> : null}
    </div>
  )
}
