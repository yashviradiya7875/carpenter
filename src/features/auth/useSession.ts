import { useCallback, useEffect, useState } from 'react'
import type { AuthAccount } from '../../shared/auth/types'
import { hasStoredSession, restoreSession, signOut as clearSession } from './authService'

/** Session lifecycle: restores a stored session on load, then tracks sign-in and sign-out. */
export function useSession() {
  const [account, setAccount] = useState<AuthAccount | null>(null)
  const [isRestoring, setIsRestoring] = useState(hasStoredSession)
  const [restoreError, setRestoreError] = useState<unknown>(null)

  useEffect(() => {
    const controller = new AbortController()
    restoreSession(controller.signal)
      .then((restored) => {
        if (restored) setAccount(restored)
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setRestoreError(error)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsRestoring(false)
      })
    return () => controller.abort()
  }, [])

  const signOut = useCallback(() => {
    clearSession()
    setAccount(null)
    setRestoreError(null)
  }, [])

  return { account, isRestoring, restoreError, signIn: setAccount, signOut }
}
