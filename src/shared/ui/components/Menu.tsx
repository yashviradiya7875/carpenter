import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../utils/cx'
import { Icon, type IconName } from '../primitives/Icon'
import './Menu.css'

const MenuContext = createContext<{ close: (restoreFocus: boolean) => void } | null>(null)

const ITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"])'
const VIEWPORT_MARGIN = 8
const TRIGGER_GAP = 4

/* --------------------------------------------------------------------- Menu */

/** Spread onto the trigger element (a Button or any focusable element). */
export type MenuTriggerProps = {
  ref: (element: HTMLElement | null) => void
  id: string
  onClick: () => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void
  'aria-haspopup': 'menu'
  'aria-expanded': boolean
  'aria-controls': string | undefined
}

export type MenuProps = {
  /** Renders the trigger. Spread the props onto it. */
  trigger: (props: MenuTriggerProps) => ReactNode
  /** MenuItem, MenuLabel and MenuSeparator elements. */
  children: ReactNode
  /** Accessible name of the menu. Defaults to the trigger's name. */
  label?: string
  /** Which trigger edge the menu lines up with. */
  align?: 'start' | 'end'
  minWidth?: number
  className?: string
}

export function Menu({ trigger, children, label, align = 'end', minWidth = 160, className }: MenuProps) {
  // null = closed; otherwise which item receives focus on open.
  const [openFocus, setOpenFocus] = useState<'first' | 'last' | null>(null)
  const open = openFocus !== null
  const triggerId = useId()
  const menuId = useId()
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const close = useCallback((restoreFocus: boolean) => {
    setOpenFocus(null)
    if (restoreFocus && triggerElement?.isConnected) triggerElement.focus()
  }, [triggerElement])

  const openMenu = (focus: 'first' | 'last') => setOpenFocus(focus)

  // Position next to the trigger (fixed, so scrolling containers can't clip it), then focus an item.
  useLayoutEffect(() => {
    if (!openFocus) return
    const menu = menuRef.current
    if (!menu || !triggerElement) return

    const position = () => {
      const rect = triggerElement.getBoundingClientRect()
      const { offsetWidth: width, offsetHeight: height } = menu
      let left = align === 'end' ? rect.right - width : rect.left
      left = Math.min(Math.max(VIEWPORT_MARGIN, left), window.innerWidth - width - VIEWPORT_MARGIN)
      let top = rect.bottom + TRIGGER_GAP
      const fitsBelow = top + height <= window.innerHeight - VIEWPORT_MARGIN
      const fitsAbove = rect.top - TRIGGER_GAP - height >= VIEWPORT_MARGIN
      const placeAbove = !fitsBelow && fitsAbove
      if (placeAbove) top = rect.top - TRIGGER_GAP - height
      menu.style.left = `${left}px`
      menu.style.top = `${top}px`
      // The enter animation scales from the corner nearest the trigger.
      menu.style.transformOrigin = `${align === 'end' ? 'right' : 'left'} ${placeAbove ? 'bottom' : 'top'}`
    }

    position()
    const items = menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR)
    const target = openFocus === 'last' ? items[items.length - 1] : items[0]
    ;(target ?? menu).focus()

    let frame = 0
    const schedule = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(position)
    }
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
    }
  }, [openFocus, align, triggerElement])

  // Close on a pointer press outside the trigger and menu.
  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || triggerElement?.contains(target)) return
      close(false)
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [open, close, triggerElement])

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(ITEM_SELECTOR))
    const index = items.indexOf(document.activeElement as HTMLElement)
    const focusAt = (next: number) => items[(next + items.length) % items.length]?.focus()

    switch (event.key) {
      case 'ArrowDown': focusAt(index + 1); break
      case 'ArrowUp': focusAt(index < 0 ? items.length - 1 : index - 1); break
      case 'Home': focusAt(0); break
      case 'End': focusAt(items.length - 1); break
      case 'Escape':
      case 'Tab':
        close(true)
        break
      default:
        return
    }
    // Keeps Escape from also closing an enclosing Dialog.
    event.preventDefault()
    event.stopPropagation()
  }

  const triggerProps: MenuTriggerProps = {
    ref: setTriggerElement,
    id: triggerId,
    onClick: () => (open ? close(false) : openMenu('first')),
    onKeyDown: (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        openMenu(event.key === 'ArrowDown' ? 'first' : 'last')
      }
    },
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
  }

  return (
    <>
      {trigger(triggerProps)}
      {open && typeof document !== 'undefined' ? createPortal(
        <MenuContext.Provider value={{ close }}>
          <div
            ref={menuRef}
            id={menuId}
            className={cx('app-menu', className)}
            role="menu"
            aria-orientation="vertical"
            aria-label={label}
            aria-labelledby={label ? undefined : triggerId}
            tabIndex={-1}
            style={{ minWidth }}
            onKeyDown={handleMenuKeyDown}
          >
            {children}
          </div>
        </MenuContext.Provider>,
        document.body,
      ) : null}
    </>
  )
}

/* ----------------------------------------------------------------- MenuItem */

export type MenuItemProps = {
  children: ReactNode
  /** Runs when the item is chosen; the menu then closes and focus returns to the trigger. */
  onSelect: () => void
  icon?: IconName
  /** 'danger' for destructive actions. */
  tone?: 'default' | 'danger'
  disabled?: boolean
}

export function MenuItem({ children, onSelect, icon, tone = 'default', disabled = false }: MenuItemProps) {
  const menu = useContext(MenuContext)

  return (
    <button
      className={cx('app-menu-item', tone === 'danger' && 'app-menu-item--danger')}
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      onPointerMove={(event) => { if (!disabled) event.currentTarget.focus() }}
      onClick={() => {
        if (disabled) return
        menu?.close(true)
        onSelect()
      }}
    >
      {icon ? <Icon name={icon} /> : null}
      <span className="app-menu-item-label">{children}</span>
    </button>
  )
}

/* ------------------------------------------------------- label & separator */

/** Non-interactive heading or context (e.g. the signed-in account). */
export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="app-menu-label" role="presentation">{children}</div>
}

export function MenuSeparator() {
  return <div className="app-menu-separator" role="separator" />
}
