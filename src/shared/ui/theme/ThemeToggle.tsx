import { Button, type ButtonProps } from '../primitives/Button'
import { useTheme } from './useTheme'

export type ThemeToggleProps = {
  size?: ButtonProps['size']
  className?: string
}

/** Icon button that switches between light and dark. Its label names the action. */
export function ThemeToggle({ size = 'sm', className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <Button
      variant="ghost"
      size={size}
      iconOnly
      icon={next === 'light' ? 'sun' : 'moon'}
      tooltip={`Switch to ${next} theme`}
      tooltipPlacement="bottom"
      className={className}
      onClick={toggleTheme}
    />
  )
}
