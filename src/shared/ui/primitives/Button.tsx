import { useId, type ButtonHTMLAttributes, type ReactElement, type ReactNode, type Ref } from 'react'
import { buttonClasses, type ButtonShape, type ButtonSize, type ButtonVariant } from './buttonClasses'
import { Icon, type IconName } from './Icon'
import './Button.css'

export type ButtonIconPosition = 'start' | 'end'

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  shape?: ButtonShape
  /** An icon name from the design system, or any SVG element. */
  icon?: IconName | ReactElement
  iconPosition?: ButtonIconPosition
  /**
   * Square button showing only the icon (or `children` as the icon).
   * Needs an accessible name: `aria-label`, `aria-labelledby` or `tooltip`.
   */
  iconOnly?: boolean
  fullWidth?: boolean
  /** Shows a spinner, sets aria-busy and ignores clicks while keeping focus. */
  loading?: boolean
  /** Replaces the label while loading. */
  loadingLabel?: ReactNode
  /** Short hint on hover and keyboard focus. Becomes the accessible name of icon-only buttons. */
  tooltip?: string
  tooltipPlacement?: 'top' | 'bottom'
  type?: 'button' | 'submit' | 'reset'
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant = 'secondary',
  size = 'md',
  shape = 'rounded',
  icon,
  iconPosition = 'start',
  iconOnly = false,
  fullWidth = false,
  loading = false,
  loadingLabel,
  tooltip,
  tooltipPlacement = 'top',
  type = 'button',
  disabled,
  className,
  children,
  ref,
  onClick,
  onKeyDown,
  onMouseLeave,
  onBlur,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  ...props
}: ButtonProps) {
  const tooltipId = useId()
  const accessibleLabel = ariaLabel ?? (iconOnly ? tooltip : undefined)
  const tooltipDescribes = Boolean(tooltip) && tooltip !== accessibleLabel
  const describedBy = [ariaDescribedBy, tooltipDescribes ? tooltipId : undefined].filter(Boolean).join(' ') || undefined

  if (import.meta.env.DEV && iconOnly && !accessibleLabel && !props['aria-labelledby']) {
    console.warn('Button: icon-only buttons need an aria-label, aria-labelledby or tooltip.')
  }

  const iconContent = icon === undefined ? (iconOnly ? children : null) : typeof icon === 'string' ? <Icon name={icon} /> : icon
  const iconNode = loading
    ? <span className="app-button-spinner" aria-hidden="true" />
    : iconContent != null ? <span className="app-button-icon" aria-hidden="true">{iconContent}</span> : null

  const labelContent = loading && loadingLabel !== undefined ? loadingLabel : children
  const labelNode = !iconOnly && labelContent != null ? <span className="app-button-label">{labelContent}</span> : null

  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={buttonClasses({ variant, size, shape, iconOnly, fullWidth, className })}
      disabled={disabled}
      aria-disabled={loading && !disabled ? true : undefined}
      aria-busy={loading || undefined}
      aria-label={accessibleLabel}
      aria-describedby={describedBy}
      onClick={(event) => {
        // Loading buttons stay focusable (no focus loss) but do nothing — including form submits.
        if (loading) {
          event.preventDefault()
          return
        }
        onClick?.(event)
      }}
      onKeyDown={(event) => {
        // WCAG 1.4.13: Escape dismisses the tooltip without moving focus or pointer.
        if (tooltip && event.key === 'Escape') event.currentTarget.dataset.tooltipDismissed = 'true'
        onKeyDown?.(event)
      }}
      onMouseLeave={(event) => {
        delete event.currentTarget.dataset.tooltipDismissed
        onMouseLeave?.(event)
      }}
      onBlur={(event) => {
        delete event.currentTarget.dataset.tooltipDismissed
        onBlur?.(event)
      }}
    >
      {iconPosition === 'end' ? labelNode : iconNode}
      {iconPosition === 'end' ? iconNode : labelNode}
      {tooltip ? (
        <span className={`app-button-tooltip app-button-tooltip--${tooltipPlacement}`} id={tooltipId} aria-hidden="true">
          {tooltip}
        </span>
      ) : null}
    </button>
  )
}
