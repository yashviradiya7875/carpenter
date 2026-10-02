import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import './Button.css'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'text'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  loadingLabel?: ReactNode
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  loadingLabel,
  disabled,
  className = '',
  type = 'button',
  children,
  ref,
  ...props
}: ButtonProps) {
  const classes = ['app-button', `app-button--${variant}`, `app-button--${size}`, className]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="app-button-spinner" aria-hidden="true" /> : null}
      {loading && loadingLabel !== undefined ? loadingLabel : children}
    </button>
  )
}