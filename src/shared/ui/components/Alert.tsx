import type { ReactNode } from 'react'
import { cx } from '../utils/cx'
import { Icon, type IconName } from '../primitives/Icon'
import './Alert.css'

export type AlertTone = 'info' | 'success' | 'warning' | 'error'

export type AlertProps = {
  tone?: AlertTone
  title?: ReactNode
  children?: ReactNode
  /** Show the tone icon. */
  icon?: boolean
  /** Renders a dismiss button when provided. */
  onDismiss?: () => void
  className?: string
}

const TONE_ICON: Record<AlertTone, IconName> = {
  info: 'info',
  success: 'check',
  warning: 'alert',
  error: 'alert',
}

export function Alert({ tone = 'info', title, children, icon = false, onDismiss, className }: AlertProps) {
  // Errors and warnings interrupt; confirmations are announced politely.
  const role = tone === 'error' || tone === 'warning' ? 'alert' : 'status'

  return (
    <div className={cx('app-alert', `app-alert--${tone}`, className)} role={role}>
      {icon ? <Icon name={TONE_ICON[tone]} className="app-alert-icon" /> : null}
      <div className="app-alert-body">
        {title ? <strong className="app-alert-title">{title}</strong> : null}
        {children ? <div className="app-alert-content">{children}</div> : null}
      </div>
      {onDismiss ? (
        <button className="app-alert-dismiss" type="button" aria-label="Dismiss" onClick={onDismiss}>
          <Icon name="close" />
        </button>
      ) : null}
    </div>
  )
}
