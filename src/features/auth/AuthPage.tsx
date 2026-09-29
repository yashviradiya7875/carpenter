import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, callApi } from '../../shared/api/client'
import { clearAuthSession, getAuthToken, getAuthUsername, setAuthSession } from '../../shared/auth/session'
import type { AuthAccount } from '../../shared/auth/types'
import DashboardPage from '../dashboard/DashboardPage'
import './AuthPage.css'

type AuthView = 'sign-in' | 'sign-up' | 'forgot-password'

function getErrorMessage(error: unknown): string {
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

function Brand() {
  return (
    <a className="brand-lockup" href="/" aria-label="Carpenter Pro home">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="m3.5 8 8.5-4.5L20.5 8 12 12.5 3.5 8Z" />
          <path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" />
        </svg>
      </span>
      <span>carpenter<span className="brand-light">.pro</span></span>
    </a>
  )
}

function PasswordIcon({ visible }: { visible: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
      {visible ? null : <path d="m4 4 16 16" />}
    </svg>
  )
}

function App() {
  const [view, setView] = useState<AuthView>('sign-in')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [account, setAccount] = useState<AuthAccount | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(
    () => Boolean(getAuthToken() && getAuthUsername()),
  )
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    const token = getAuthToken()
    const savedUsername = getAuthUsername()
    if (!token || !savedUsername) {
      if (token || savedUsername) clearAuthSession()
      return
    }

    const controller = new AbortController()
    callApi<AuthAccount, { username: string }>(
      'getCurrentUser',
      { username: savedUsername },
      { signal: controller.signal },
    )
      .then((currentAccount) => {
        if (!currentAccount.allowedApps?.includes('CARPENTER')) {
          clearAuthSession()
          setErrorMessage('This account is not enabled for Carpenter Pro. Contact your organization administrator.')
          return
        }
        setAccount(currentAccount)
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        if (requestError instanceof ApiError && requestError.httpStatus === 401) clearAuthSession()
        setErrorMessage(getErrorMessage(requestError))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsCheckingSession(false)
      })

    return () => controller.abort()
  }, [])

  const changeView = (nextView: AuthView) => {
    setView(nextView)
    setErrorMessage('')
    setSuccessMessage('')
    setPassword('')
    setConfirmPassword('')
    setPasswordVisible(false)
    setConfirmPasswordVisible(false)
  }

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    setIsBusy(true)

    try {
      const signedInAccount = await callApi<AuthAccount, { username: string; password: string }>(
        'login',
        { username: identifier.trim(), password },
      )
      if (!signedInAccount.allowedApps?.includes('CARPENTER')) {
        clearAuthSession()
        setErrorMessage('This account is not enabled for Carpenter Pro. Contact your organization administrator.')
        return
      }
      if (!signedInAccount.token) throw new Error('The sign-in response did not include a session token.')
      setAuthSession(signedInAccount.token, signedInAccount.username, rememberMe)
      setAccount(signedInAccount)
    } catch (requestError) {
      setErrorMessage(getErrorMessage(requestError))
    } finally {
      setIsBusy(false)
    }
  }

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    if (password !== confirmPassword) {
      setErrorMessage('Your passwords do not match.')
      return
    }

    setIsBusy(true)
    try {
      await callApi<AuthAccount, { username: string; email: string; password: string }>(
        'signup',
        { username: username.trim(), email: email.trim(), password },
      )
      setIdentifier(username.trim())
      setPassword('')
      changeView('sign-in')
      setSuccessMessage('Your account has been created. Follow any verification email, then sign in after approval.')
    } catch (requestError) {
      setErrorMessage(getErrorMessage(requestError))
    } finally {
      setIsBusy(false)
    }
  }

  const handleForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    setIsBusy(true)

    try {
      await callApi<{ success: boolean; message?: string }, { username: string }>(
        'forgotPassword',
        { username: identifier.trim() },
      )
      setSuccessMessage('If an account matches that identifier, a password reset link will be sent.')
    } catch (requestError) {
      setErrorMessage(getErrorMessage(requestError))
    } finally {
      setIsBusy(false)
    }
  }

  const handleSignOut = () => {
    clearAuthSession()
    setAccount(null)
    setIdentifier('')
    setPassword('')
    setRememberMe(false)
    setErrorMessage('')
    setSuccessMessage('')
  }

  if (isCheckingSession) {
    return (
      <main className="checking-screen" aria-label="Restoring your session">
        <span className="loading-indicator" />
        <p>Restoring your workspace...</p>
      </main>
    )
  }

  if (account) {
    return <DashboardPage account={account} onSignOut={handleSignOut} />
  }

  const isSignIn = view === 'sign-in'
  const isSignUp = view === 'sign-up'

  return (
    <main className="auth-layout">
      <section className="auth-visual" aria-label="Carpenter Pro material studio">
       
        <div className="visual-shade" />
        <div className="visual-brand"><Brand /></div>
        <div className="visual-copy">
          <span>CARPENTER PRO</span>
          <h1>{isSignUp ? 'Get Started with Us' : isSignIn ? 'Welcome Back to Your Studio' : 'Let’s Get You Back In'}</h1>
          <p>{isSignUp
            ? 'Complete these steps to register your account.'
            : isSignIn
              ? 'Sign in to continue creating thoughtful material previews for your clients.'
              : 'Follow a few simple steps to return to your material studio.'}</p>
          <ol className="auth-steps" aria-label="Carpenter account steps">
            <li className={isSignUp ? 'is-active' : ''}>
              <span>1</span><strong>Sign up your account</strong>
            </li>
            <li>
              <span>2</span><strong>Set up your workspace</strong>
            </li>
            <li className={isSignIn ? 'is-active' : ''}>
              <span>3</span><strong>Set up your profile</strong>
            </li>
          </ol>
        </div>
        <span className="visual-index" aria-hidden="true">01 / 03</span>
      </section>

      <section className="auth-main">
        <div className="auth-mobile-brand"><Brand /></div>
        <div className="auth-content">
          <span className="auth-kicker">
            {isSignIn ? 'CARPENTER PRO' : isSignUp ? 'NEW ACCOUNT' : 'ACCOUNT RECOVERY'}
          </span>
          <h2>
            {isSignIn ? 'Welcome back' : isSignUp ? 'Sign Up Account' : 'Reset password'}
          </h2>
          <p className="auth-intro">
            {isSignIn
              ? 'Enter your account details to continue.'
              : isSignUp
                ? 'Enter your personal details to create your Carpenter account.'
                : 'Enter the username associated with your account and we will send a reset link.'}
          </p>

          {errorMessage ? <p className="form-message form-error" role="alert">{errorMessage}</p> : null}
          {successMessage ? <p className="form-message form-success" role="status">{successMessage}</p> : null}

          {isSignIn ? (
            <form className="auth-form" onSubmit={handleSignIn}>
              <label className="auth-field">
                <span>Email or username</span>
                <input
                  type="text"
                  name="identifier"
                  autoComplete="username"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="you@company.com"
                  required
                />
              </label>
              <label className="auth-field">
                <span>Password</span>
                <span className="password-input-wrap">
                  <input
                    type={passwordVisible ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    className="password-visibility"
                    type="button"
                    aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                    aria-pressed={passwordVisible}
                    onClick={() => setPasswordVisible((visible) => !visible)}
                  >
                    <PasswordIcon visible={passwordVisible} />
                  </button>
                </span>
              </label>
              <div className="form-options">
                <label className="remember-control">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  <span>Remember me</span>
                </label>
                <button className="text-button" type="button" onClick={() => changeView('forgot-password')}>
                  Forgot password?
                </button>
              </div>
              <button className="submit-button" type="submit" disabled={isBusy}>
                {isBusy ? <><span className="button-spinner" /> Signing in...</> : <>Sign in <span aria-hidden="true">&#8594;</span></>}
              </button>
            </form>
          ) : null}

          {isSignUp ? (
            <form className="auth-form" onSubmit={handleSignUp}>
              <div className="auth-field-grid">
                <label className="auth-field">
                  <span>Username</span>
                  <input
                    type="text"
                    name="username"
                    autoComplete="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Choose a username"
                    required
                  />
                </label>
                <label className="auth-field">
                  <span>Email address</span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    required
                  />
                </label>
              </div>
              <div className="auth-field-grid">
                <label className="auth-field">
                  <span>Password</span>
                  <span className="password-input-wrap">
                    <input
                      type={passwordVisible ? 'text' : 'password'}
                      name="new-password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      className="password-visibility"
                      type="button"
                      aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                      aria-pressed={passwordVisible}
                      onClick={() => setPasswordVisible((visible) => !visible)}
                    >
                      <PasswordIcon visible={passwordVisible} />
                    </button>
                  </span>
                </label>
                <label className="auth-field">
                  <span>Confirm password</span>
                  <span className="password-input-wrap">
                    <input
                      type={confirmPasswordVisible ? 'text' : 'password'}
                      name="confirm-password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Confirm your password"
                      required
                    />
                    <button
                      className="password-visibility"
                      type="button"
                      aria-label={confirmPasswordVisible ? 'Hide confirmation password' : 'Show confirmation password'}
                      aria-pressed={confirmPasswordVisible}
                      onClick={() => setConfirmPasswordVisible((visible) => !visible)}
                    >
                      <PasswordIcon visible={confirmPasswordVisible} />
                    </button>
                  </span>
                </label>
              </div>
              <button className="submit-button" type="submit" disabled={isBusy}>
                {isBusy ? <><span className="button-spinner" /> Creating account...</> : <>Sign Up <span aria-hidden="true">&#8594;</span></>}
              </button>
            </form>
          ) : null}

          {!isSignIn && !isSignUp ? (
            <form className="auth-form" onSubmit={handleForgotPassword}>
              <label className="auth-field">
                <span>Account username</span>
                <input
                  type="text"
                  name="identifier"
                  autoComplete="username"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="Enter your username"
                  required
                />
              </label>
              <button className="submit-button" type="submit" disabled={isBusy}>
                {isBusy ? <><span className="button-spinner" /> Sending link...</> : <>Send reset link <span aria-hidden="true">&#8594;</span></>}
              </button>
            </form>
          ) : null}

          <div className="auth-switch">
            {isSignIn ? (
              <p>New to Carpenter Pro? <button className="text-button" type="button" onClick={() => changeView('sign-up')}>Sign up</button></p>
            ) : (
                <p>Already have an account? <button className="text-button" type="button" onClick={() => changeView('sign-in')}>Log in</button></p>
            )}
          </div>
          <p className="auth-terms">By continuing, you agree to use Carpenter Pro in accordance with your organization's access policies.</p>
        </div>
        
      </section>
    </main>
  )
}

export default App