const AUTH_TOKEN_KEY = 'carpenter-pro.auth-token'
const AUTH_USERNAME_KEY = 'carpenter-pro.auth-username'

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(AUTH_TOKEN_KEY) || window.localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function getAuthUsername(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(AUTH_USERNAME_KEY) || window.localStorage.getItem(AUTH_USERNAME_KEY)
  } catch {
    return null
  }
}

export function setAuthSession(token: string, username: string, rememberMe: boolean): void {
  if (typeof window === 'undefined') return
  const targetStorage = rememberMe ? window.localStorage : window.sessionStorage
  const otherStorage = rememberMe ? window.sessionStorage : window.localStorage
  otherStorage.removeItem(AUTH_TOKEN_KEY)
  otherStorage.removeItem(AUTH_USERNAME_KEY)
  targetStorage.setItem(AUTH_TOKEN_KEY, token)
  targetStorage.setItem(AUTH_USERNAME_KEY, username)
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(AUTH_TOKEN_KEY)
  window.sessionStorage.removeItem(AUTH_USERNAME_KEY)
  window.localStorage.removeItem(AUTH_TOKEN_KEY)
  window.localStorage.removeItem(AUTH_USERNAME_KEY)
}