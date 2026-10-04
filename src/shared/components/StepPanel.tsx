import { useId, type ReactNode, type Ref } from 'react'
import { Button, cx } from '../ui'
import './StepPanel.css'

export type StepPanelProps = {
  title: ReactNode
  description?: ReactNode
  /** Returns to the previous step. */
  onBack: () => void
  backLabel?: ReactNode
  /** Summary and the confirm action, pinned under the content. */
  footer?: ReactNode
  /** Hides the step without unmounting it, so what was chosen survives moving between steps. */
  hidden?: boolean
  /** The step's root; focus it when the step is shown. */
  ref?: Ref<HTMLElement>
  className?: string
  children: ReactNode
}

/**
 * Frame for one step of an inline flow (room selection, material placement): a Back
 * action and heading on top, the step's content, and a footer for its confirm action.
 * It fills its host; only the content inside is expected to scroll.
 */
export function StepPanel({ title, description, onBack, backLabel = 'Back', footer, hidden = false, ref, className, children }: StepPanelProps) {
  const titleId = useId()

  return (
    <section ref={ref} className={cx('step-panel app-enter', className)} hidden={hidden} tabIndex={-1} aria-labelledby={titleId}>
      <header className="step-panel-header">
        <Button className="step-panel-back" variant="ghost" size="sm" shape="pill" icon="back" onClick={onBack}>{backLabel}</Button>
        <div className="step-panel-heading">
          <h2 id={titleId}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </header>
      {children}
      {footer ? <footer className="step-panel-footer">{footer}</footer> : null}
    </section>
  )
}
