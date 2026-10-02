import { useEffect, useId, useRef, type FormEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../utils/cx'
import { Icon, type IconName } from '../primitives/Icon'
import { focusableWithin, trapFocus } from '../utils/focus'
import './Dialog.css'

export type DialogSize = 'sm' | 'md' | 'lg'

export type DialogProps = {
  open: boolean
  /** Called on Escape, backdrop click and the close button (when dismissible). */
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  /** Action row, typically Buttons. */
  footer?: ReactNode
  size?: DialogSize
  /** Use 'alertdialog' for confirmations that interrupt the user. */
  role?: 'dialog' | 'alertdialog'
  /** Set false while work is in progress to block every way of closing. */
  dismissible?: boolean
  closeOnBackdrop?: boolean
  hideCloseButton?: boolean
  /** Header icon. */
  icon?: IconName
  iconTone?: 'accent' | 'danger'
  /** Element to focus on open; defaults to the first focusable control in the body. */
  initialFocusRef?: RefObject<HTMLElement | null>
  /** Renders the panel as a <form> so footer submit buttons work. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void
  className?: string
}

// Open dialogs, innermost last: only the top one reacts to Escape and Tab.
const openDialogs: symbol[] = []
let scrollLocks = 0
let restoreOverflow = ''

function lockScroll() {
  if (scrollLocks === 0) {
    restoreOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  scrollLocks += 1
}

function unlockScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1)
  if (scrollLocks === 0) document.body.style.overflow = restoreOverflow
}

export function Dialog(props: DialogProps) {
  if (!props.open || typeof document === 'undefined') return null
  return createPortal(<DialogPanel {...props} />, document.body)
}

function DialogPanel({
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  role = 'dialog',
  dismissible = true,
  closeOnBackdrop = true,
  hideCloseButton = false,
  icon,
  iconTone = 'accent',
  initialFocusRef,
  onSubmit,
  className,
}: DialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  const dismissibleRef = useRef(dismissible)

  useEffect(() => {
    onCloseRef.current = onClose
    dismissibleRef.current = dismissible
  })

  useEffect(() => {
    const token = Symbol('dialog')
    const panel = panelRef.current
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    openDialogs.push(token)
    lockScroll()

    const frame = window.requestAnimationFrame(() => {
      if (!panel || panel.contains(document.activeElement)) return // respects autoFocus inside the content
      const body = panel.querySelector<HTMLElement>('.app-dialog-body')
      const target = initialFocusRef?.current
        ?? (body ? focusableWithin(body)[0] : undefined)
        ?? focusableWithin(panel)[0]
        ?? panel
      target.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== token) return
      if (event.key === 'Escape') {
        event.stopPropagation()
        if (dismissibleRef.current) onCloseRef.current()
      } else if (event.key === 'Tab' && panel) {
        trapFocus(event, panel)
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKeyDown)
      openDialogs.splice(openDialogs.indexOf(token), 1)
      unlockScroll()
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [initialFocusRef])

  const panelProps = {
    className: cx('app-dialog', `app-dialog--${size}`, className),
    role,
    'aria-modal': true,
    'aria-labelledby': titleId,
    'aria-describedby': description ? descriptionId : undefined,
    tabIndex: -1,
  } as const

  const content = (
    <>
      <header className="app-dialog-header">
        {icon ? <span className={cx('app-dialog-icon', `app-dialog-icon--${iconTone}`)}><Icon name={icon} /></span> : null}
        <div className="app-dialog-heading">
          <h2 className="app-dialog-title" id={titleId}>{title}</h2>
          {description ? <p className="app-dialog-description" id={descriptionId}>{description}</p> : null}
        </div>
        {hideCloseButton ? null : (
          <button className="app-dialog-close" type="button" aria-label="Close" disabled={!dismissible} onClick={onClose}>
            <Icon name="close" />
          </button>
        )}
      </header>
      {children ? <div className="app-dialog-body">{children}</div> : null}
      {footer ? <footer className="app-dialog-footer">{footer}</footer> : null}
    </>
  )

  return (
    <div
      className="app-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && closeOnBackdrop && dismissible) onClose()
      }}
    >
      {onSubmit ? (
        <form {...panelProps} ref={panelRef as RefObject<HTMLFormElement>} onSubmit={onSubmit}>{content}</form>
      ) : (
        <section {...panelProps} ref={panelRef}>{content}</section>
      )}
    </div>
  )
}
