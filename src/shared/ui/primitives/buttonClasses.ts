import { cx } from '../utils/cx'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'
export type ButtonShape = 'rounded' | 'pill'

export type ButtonClassOptions = {
  variant?: ButtonVariant
  size?: ButtonSize
  shape?: ButtonShape
  iconOnly?: boolean
  fullWidth?: boolean
  className?: string
}

/**
 * Button styling as a class string. Use it to give an <a> (navigation) the same
 * look as <Button> (actions): `<a className={buttonClasses({ variant: 'secondary' })} href="/">`.
 */
export function buttonClasses({
  variant = 'secondary',
  size = 'md',
  shape = 'rounded',
  iconOnly = false,
  fullWidth = false,
  className,
}: ButtonClassOptions = {}): string {
  return cx(
    'app-button',
    `app-button--${variant}`,
    `app-button--${size}`,
    shape === 'pill' && 'app-button--pill',
    iconOnly && 'app-button--icon-only',
    fullWidth && 'app-button--full',
    className,
  )
}
