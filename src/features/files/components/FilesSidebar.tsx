import { useEffect, useRef, type ReactNode } from 'react'
import { Mark } from '../../../shared/components/Mark'
import { Button, cx, type IconName } from '../../../shared/ui'

export type FilesSection = 'files' | 'assets' | 'recent' | 'favorites' | 'shared' | 'library' | 'renders' | 'sources' | 'links'

export type FilesNavItem = {
  id: FilesSection
  label: string
  icon: IconName
  /** How many items the section holds, when that is known without asking the API again. */
  count?: number
  /** Starts a new group with a thin divider above. */
  divided?: boolean
}

type FilesSidebarProps = {
  items: FilesNavItem[]
  active: FilesSection
  onSelect: (section: FilesSection) => void
  /** Narrow rail of icons instead of the full sidebar. */
  collapsed: boolean
  onToggleCollapsed: () => void
  /** Shown under the sections, e.g. the folder tree of My Files. */
  children?: ReactNode
}

/**
 * Files navigation: the sections as a compact list, with room below for the folder tree.
 * Collapses to an icon rail on request and on medium screens, and becomes a scrolling
 * strip above the content on phones.
 */
export function FilesSidebar({ items, active, onSelect, collapsed, onToggleCollapsed, children }: FilesSidebarProps) {
  const activeItem = useRef<HTMLButtonElement>(null)

  // On phones the sections scroll sideways; keep the open one in view.
  useEffect(() => {
    activeItem.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [active])

  return (
    <aside className={cx('files-sidebar', collapsed && 'is-collapsed')}>
      <div className="files-sidebar-head">
        <strong>Files</strong>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon={collapsed ? 'arrow' : 'back'}
          className="files-sidebar-toggle"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          onClick={onToggleCollapsed}
        />
      </div>
      <nav aria-label="Files sections">
        <ul className="files-nav">
          {items.map((item) => (
            <li key={item.id} className={cx(item.divided && 'is-divided')}>
              <button
                ref={active === item.id ? activeItem : undefined}
                type="button"
                className={cx('files-nav-item', active === item.id && 'is-active')}
                aria-current={active === item.id ? 'page' : undefined}
                title={item.label}
                onClick={() => onSelect(item.id)}
              >
                <Mark name={item.icon} />
                <span>{item.label}</span>
                {typeof item.count === 'number' ? <small>{item.count}</small> : null}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {children ? <div className="files-sidebar-extra">{children}</div> : null}
    </aside>
  )
}
