import type { ReactNode } from 'react'
import { roleLabel } from '../auth/account'
import type { AuthAccount } from '../auth/types'
import { Menu, MenuItem, MenuLabel, MenuSeparator, ThemeToggle, TopBar } from '../ui'
import { Brand } from './Brand'
import { Mark } from './Mark'
import './AppHeader.css'

export type AppHeaderProps = {
  /** The signed-in account. Shows credits and the account menu; omit on public pages. */
  account?: AuthAccount | null
  credits?: number
  onSignOut?: () => void
  /** Makes the logo return to the studio. */
  onHome?: () => void
  /** Extra actions before the theme toggle, e.g. a link on public pages. */
  actions?: ReactNode
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'CP'
}

/** The application's single global header. The app shell renders it once, above every page. */
export function AppHeader({ account, credits, onSignOut, onHome, actions }: AppHeaderProps) {
  const userName = account ? account.displayName || account.username : ''

  return (
    <TopBar
      sticky
      className="app-header"
      start={onHome ? (
        <button className="app-header-home" type="button" onClick={onHome}>
          <Brand />
        </button>
      ) : <Brand />}
      end={(
        <>
          {actions}
          {account && typeof credits === 'number' ? (
            <div className="credit-balance">
              <Mark name="spark" />
              <span className="credit-balance-value">{credits}</span>
              <span className="credit-balance-label">Credits left</span>
            </div>
          ) : null}
          <ThemeToggle />
          {account ? (
            <Menu
              label="Account"
              minWidth={210}
              trigger={(props) => (
                <button {...props} className="profile-trigger" type="button" aria-label="Open account menu">
                  <span>{initials(userName)}</span>
                </button>
              )}
            >
              <MenuLabel><strong>{userName}</strong>{roleLabel(account.role)}</MenuLabel>
              <MenuSeparator />
              <MenuItem onSelect={() => onSignOut?.()}>Sign out</MenuItem>
            </Menu>
          ) : null}
        </>
      )}
    />
  )
}
