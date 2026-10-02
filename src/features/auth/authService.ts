import { ApiError, callApi } from '../../shared/api/client'
import { hasCarpenterAccess, NO_CARPENTER_ACCESS_MESSAGE } from '../../shared/auth/account'
import { clearAuthSession, getAuthToken, getAuthUsername, setAuthSession } from '../../shared/auth/session'
import type { AuthAccount } from '../../shared/auth/types'

/** The credentials are valid but the account is not enabled for Carpenter Pro. */
export class CarpenterAccessError extends Error {
  constructor() {
    super(NO_CARPENTER_ACCESS_MESSAGE)
    this.name = 'CarpenterAccessError'
  }
}

/** Signs in and stores the session (persistently when `rememberMe`). */
export async function signIn(identifier: string, password: string, rememberMe: boolean): Promise<AuthAccount> {
  const account = await callApi<AuthAccount, { username: string; password: string }>(
    'login',
    { username: identifier.trim(), password },
  )
  if (!hasCarpenterAccess(account)) {
    clearAuthSession()
    throw new CarpenterAccessError()
  }
  if (!account.token) throw new Error('The sign-in response did not include a session token.')
  setAuthSession(account.token, account.username, rememberMe)
  return account
}

/** Self sign-up; the API creates a generic account pending approval. */
export function signUp(username: string, email: string, password: string) {
  return callApi<AuthAccount, { username: string; email: string; password: string }>(
    'signup',
    { username: username.trim(), email: email.trim(), password },
  )
}

export function requestPasswordReset(identifier: string) {
  return callApi<{ success: boolean; message?: string }, { username: string }>(
    'forgotPassword',
    { username: identifier.trim() },
  )
}

export function hasStoredSession(): boolean {
  return Boolean(getAuthToken() && getAuthUsername())
}

/**
 * Validates the stored session with the API. Resolves `null` when there is none,
 * and clears it when it is rejected or no longer has Carpenter access.
 */
export async function restoreSession(signal?: AbortSignal): Promise<AuthAccount | null> {
  const token = getAuthToken()
  const savedUsername = getAuthUsername()
  if (!token || !savedUsername) {
    if (token || savedUsername) clearAuthSession()
    return null
  }

  try {
    const account = await callApi<AuthAccount, { username: string }>('getCurrentUser', { username: savedUsername }, { signal })
    if (!hasCarpenterAccess(account)) {
      clearAuthSession()
      throw new CarpenterAccessError()
    }
    return account
  } catch (error) {
    if (error instanceof ApiError && error.httpStatus === 401) clearAuthSession()
    throw error
  }
}

export function signOut(): void {
  clearAuthSession()
}

/** User-facing message for sign-in, sign-up, recovery and session errors. */
export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof CarpenterAccessError) return error.message
  if (error instanceof ApiError) {
    if (error.httpStatus && error.httpStatus >= 500) {
      return 'We could not complete that request. Please try again shortly.'
    }
    if (error.code === 'resource-exhausted') {
      return 'Too many attempts. Please wait a few minutes and try again.'
    }
    return error.message
  }
  return 'Something went wrong. Please try again.'
}
