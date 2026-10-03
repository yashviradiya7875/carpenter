/**
 * Render pricing by account tier.
 *
 * The API prices a render by the account's resolution tier, which an admin sets per
 * account and `login` / `getCurrentUser` return as `resolution`. The API has no price
 * lookup, so this table mirrors the server's — the same approach as the Surus Studio
 * frontend. Keep it the only place prices appear; if the server's prices change,
 * update it here.
 */
export type Resolution = '1K' | '2K' | '4K'

const RESOLUTIONS: Resolution[] = ['1K', '2K', '4K']

/** Accounts start on the cheapest tier. */
export const DEFAULT_RESOLUTION: Resolution = '1K'

const RESOLUTION_CREDIT_COST: Record<Resolution, number> = {
  '1K': 2,
  '2K': 3,
  '4K': 4,
}

/** Credits one render costs at the account's tier. Unknown or missing tiers use the default. */
export function creditCostFor(resolution?: string | null): number {
  const tier = RESOLUTIONS.includes(resolution as Resolution) ? (resolution as Resolution) : DEFAULT_RESOLUTION
  return RESOLUTION_CREDIT_COST[tier]
}
