// Design system public API. Import from 'shared/ui' rather than individual files.
// Requires './styles/index.css' to be loaded once at the app entry.

// Primitives: single-purpose building blocks
export { Button, type ButtonIconPosition, type ButtonProps } from './primitives/Button'
export { buttonClasses, type ButtonClassOptions, type ButtonShape, type ButtonSize, type ButtonVariant } from './primitives/buttonClasses'
export {
  Field,
  Select,
  Textarea,
  TextInput,
  type ControlSize,
  type FieldProps,
  type SelectProps,
  type TextareaProps,
  type TextInputProps,
} from './primitives/Field'
export { Icon, type IconName, type IconProps } from './primitives/Icon'
export { Spinner, type SpinnerProps, type SpinnerSize } from './primitives/Spinner'

// Components: composed from primitives, with behavior
export { Alert, type AlertProps, type AlertTone } from './components/Alert'
export { AnimatedGridPattern, type AnimatedGridPatternProps } from './components/AnimatedGridPattern'
export { ConfirmDialog, type ConfirmDialogProps } from './components/ConfirmDialog'
export { Dialog, type DialogProps, type DialogSize } from './components/Dialog'
export { EmptyState, type EmptyStateProps } from './components/EmptyState'
export { GeneratingLoader, type GeneratingLoaderProgress, type GeneratingLoaderProps } from './components/GeneratingLoader'
export { LoadingState, type LoadingStateProps } from './components/LoadingState'
export {
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  type MenuItemProps,
  type MenuProps,
  type MenuTriggerProps,
} from './components/Menu'

export { Tabs, type TabItem, type TabsProps } from './components/Tabs'

// Layout
export { TopBar, type TopBarProps } from './layout/TopBar'

// Theme
export { ThemeProvider, type ThemeProviderProps } from './theme/ThemeProvider'
export { ThemeToggle, type ThemeToggleProps } from './theme/ThemeToggle'
export { useTheme } from './theme/useTheme'
export type { Theme, ThemeContextValue } from './theme/themeContext'

// Tokens and utilities
export { breakpoints, durations, maxWidth, zIndex, type Breakpoint } from './tokens/tokens'
export { cx } from './utils/cx'
export { focusableWithin, trapFocus } from './utils/focus'
export { usePrefersReducedMotion } from './utils/usePrefersReducedMotion'
