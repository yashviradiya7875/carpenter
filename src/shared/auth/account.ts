import type { AuthAccount } from './types'

/** Only accounts with the Carpenter app enabled may use this frontend. */
export function hasCarpenterAccess(account: Pick<AuthAccount, 'allowedApps'>): boolean {
  return account.allowedApps?.includes('CARPENTER') === true
}

export const NO_CARPENTER_ACCESS_MESSAGE = 'This account is not enabled for Carpenter Pro. Contact your organization administrator.'

/** Carpenter market names for API roles. */
export function roleLabel(role: string): string {
  if (role === 'organization') return 'Manufacturer'
  if (role === 'org_user') return 'Sponsored Dealer'
  if (role === 'user') return 'Dealer Pro'
  return role
}
