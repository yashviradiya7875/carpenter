import { useRef, type KeyboardEvent } from 'react'
import { cx } from '../utils/cx'
import './Tabs.css'

export type TabItem = {
  id: string
  label: string
  /** Optional count shown after the label. */
  count?: number
}

export type TabsProps = {
  tabs: TabItem[]
  /** Id of the selected tab. */
  value: string
  onChange: (id: string) => void
  /** Accessible name for the tab list, e.g. "Room categories". */
  label: string
  /** Id of the element the tabs control (give it `role="tabpanel"`). */
  panelId?: string
  className?: string
}

/**
 * A row of tabs that switches what one panel shows. Follows the WAI-ARIA tabs pattern:
 * one tab stop, arrow keys / Home / End move and select. Scrolls sideways when crowded.
 */
export function Tabs({ tabs, value, onChange, label, panelId, className }: TabsProps) {
  const listRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === value)
    const lastIndex = tabs.length - 1
    const nextIndex = event.key === 'ArrowRight' ? (index >= lastIndex ? 0 : index + 1)
      : event.key === 'ArrowLeft' ? (index <= 0 ? lastIndex : index - 1)
        : event.key === 'Home' ? 0
          : event.key === 'End' ? lastIndex
            : -1
    if (nextIndex < 0 || !tabs[nextIndex]) return
    event.preventDefault()
    onChange(tabs[nextIndex].id)
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus()
  }

  return (
    <div ref={listRef} className={cx('app-tabs', className)} role="tablist" aria-label={label} onKeyDown={handleKeyDown}>
      {tabs.map((tab) => {
        const selected = tab.id === value
        return (
          <button
            key={tab.id}
            className="app-tab"
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {typeof tab.count === 'number' ? <span className="app-tab-count">{tab.count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
