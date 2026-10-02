import {
  createContext,
  useContext,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cx } from '../utils/cx'
import { Icon, type IconName } from './Icon'
import './Field.css'

type FieldContextValue = {
  id: string
  describedBy?: string
  invalid: boolean
  required: boolean
}

const FieldContext = createContext<FieldContextValue | null>(null)

export type ControlSize = 'sm' | 'md' | 'lg'

/* -------------------------------------------------------------------- Field */

export type FieldProps = {
  label: ReactNode
  /** Helper text under the control. */
  hint?: ReactNode
  /** Error text; also marks the control invalid. */
  error?: ReactNode
  required?: boolean
  /** Keep the label for assistive technology only. */
  hideLabel?: boolean
  /** Explicit control id; generated when omitted. */
  id?: string
  className?: string
  children: ReactNode
}

export function Field({ label, hint, error, required = false, hideLabel = false, id, className, children }: FieldProps) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  const hintId = hint ? `${controlId}-hint` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <FieldContext.Provider value={{ id: controlId, describedBy, invalid: Boolean(error), required }}>
      <div className={cx('app-field', className)}>
        <label className={cx('app-field-label', hideLabel && 'sr-only')} htmlFor={controlId}>
          {label}
          {required ? <span className="app-field-required" aria-hidden="true">*</span> : null}
        </label>
        {children}
        {hint ? <p className="app-field-hint" id={hintId}>{hint}</p> : null}
        {error ? <p className="app-field-error" id={errorId}>{error}</p> : null}
      </div>
    </FieldContext.Provider>
  )
}

/** Merges Field context into a control's accessibility props. */
function useFieldControl(props: { id?: string; 'aria-describedby'?: string; invalid?: boolean; required?: boolean }) {
  const field = useContext(FieldContext)
  const describedBy = [field?.describedBy, props['aria-describedby']].filter(Boolean).join(' ') || undefined
  const invalid = props.invalid ?? field?.invalid ?? false
  return {
    id: props.id ?? field?.id,
    'aria-describedby': describedBy,
    'aria-invalid': invalid || undefined,
    required: props.required ?? field?.required,
  }
}

/* ---------------------------------------------------------------- TextInput */

export type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  size?: ControlSize
  invalid?: boolean
  /** Decorative icon at the start of the control. */
  startIcon?: IconName
  /** Content at the end of the control, e.g. a show-password button. */
  endSlot?: ReactNode
  ref?: Ref<HTMLInputElement>
}

export function TextInput({ size = 'md', invalid, startIcon, endSlot, className, ref, ...props }: TextInputProps) {
  const control = useFieldControl({ ...props, invalid })

  return (
    <span className={cx('app-control', `app-control--${size}`, startIcon && 'has-start', endSlot != null && 'has-end', className)}>
      {startIcon ? <Icon name={startIcon} className="app-control-icon" /> : null}
      <input {...props} {...control} ref={ref} className="app-control-input" />
      {endSlot ? <span className="app-control-end">{endSlot}</span> : null}
    </span>
  )
}

/* ------------------------------------------------------------------- Select */

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  size?: ControlSize
  invalid?: boolean
  ref?: Ref<HTMLSelectElement>
}

export function Select({ size = 'md', invalid, className, children, ref, ...props }: SelectProps) {
  const control = useFieldControl({ ...props, invalid })

  return (
    <span className={cx('app-control', 'app-control--select', `app-control--${size}`, className)}>
      <select {...props} {...control} ref={ref} className="app-control-input">
        {children}
      </select>
      <Icon name="arrow" className="app-control-chevron" />
    </span>
  )
}

/* ----------------------------------------------------------------- Textarea */

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean
  ref?: Ref<HTMLTextAreaElement>
}

export function Textarea({ invalid, className, ref, ...props }: TextareaProps) {
  const control = useFieldControl({ ...props, invalid })

  return (
    <span className={cx('app-control', 'app-control--textarea', className)}>
      <textarea {...props} {...control} ref={ref} className="app-control-input" />
    </span>
  )
}
