import { useEffect, useState, type FormEvent } from 'react'
import type { AuthAccount } from '../../shared/auth/types'
import { Alert, Button } from '../../shared/ui'
import { getAuthErrorMessage, requestPasswordReset, signIn, signUp } from './authService'
import './AuthPage.css'

type AuthView = 'sign-in' | 'sign-up' | 'forgot-password'

type AuthPageProps = {
  /** Called with the signed-in account once its session is stored. */
  onSignedIn: (account: AuthAccount) => void
  /** An error from restoring a previous session, shown on arrival. */
  initialError?: unknown
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

function AuthPage({ onSignedIn, initialError }: AuthPageProps) {
  const [view, setView] = useState<AuthView>('sign-in')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState(() => (initialError ? getAuthErrorMessage(initialError) : ''))
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    document.title = `${view === 'sign-up' ? 'Create account' : view === 'forgot-password' ? 'Reset password' : 'Sign in'} · Carpenter Pro`
  }, [view])

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
      onSignedIn(await signIn(identifier, password, rememberMe))
    } catch (requestError) {
      setErrorMessage(getAuthErrorMessage(requestError))
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
      await signUp(username, email, password)
      setIdentifier(username.trim())
      setPassword('')
      changeView('sign-in')
      setSuccessMessage('Your account has been created. Follow any verification email, then sign in after approval.')
    } catch (requestError) {
      setErrorMessage(getAuthErrorMessage(requestError))
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
      await requestPasswordReset(identifier)
      setSuccessMessage('If an account matches that identifier, a password reset link will be sent.')
    } catch (requestError) {
      setErrorMessage(getAuthErrorMessage(requestError))
    } finally {
      setIsBusy(false)
    }
  }

  const isSignIn = view === 'sign-in'
  const isSignUp = view === 'sign-up'

  return (
    <main className="auth-layout app-enter-fade">
      <section className="auth-visual" aria-label="Carpenter Pro material studio">
       
        <div className="visual-shade" />
        <div className="visual-brand"><Brand /></div>
        <div className="visual-copy">
          <span>CARPENTER PRO</span>
          <div className="visual-title">{isSignUp ? 'Get Started with Us' : isSignIn ? 'Welcome Back to Your Studio' : 'Let’s Get You Back In'}</div>
          <p>{isSignUp
            ? 'Complete these steps to register your account.'
            : isSignIn
              ? 'Sign in to continue creating thoughtful material previews for your clients.'
              : 'Follow a few simple steps to return to your material studio.'}</p>
          {isSignUp ? (
            <ol className="auth-steps" aria-label="Carpenter account steps">
              <li className="is-active" aria-current="step">
                <span>1</span><strong>Sign up your account</strong>
              </li>
              <li>
                <span>2</span><strong>Set up your workspace</strong>
              </li>
              <li>
                <span>3</span><strong>Set up your profile</strong>
              </li>
            </ol>
          ) : null}
        </div>
      </section>

      <section className="auth-main">
        <div className="auth-mobile-brand"><Brand /></div>
        <div className="auth-content" key={view}>
          <span className="auth-kicker">
            {isSignIn ? 'CARPENTER PRO' : isSignUp ? 'NEW ACCOUNT' : 'ACCOUNT RECOVERY'}
          </span>
          <h1>
            {isSignIn ? 'Welcome back' : isSignUp ? 'Sign Up Account' : 'Reset password'}
          </h1>
          <p className="auth-intro">
            {isSignIn
              ? 'Enter your account details to continue.'
              : isSignUp
                ? 'Enter your personal details to create your Carpenter account.'
                : 'Enter the username associated with your account and we will send a reset link.'}
          </p>

          {errorMessage ? <Alert tone="error" className="form-message">{errorMessage}</Alert> : null}
          {successMessage ? <Alert tone="success" className="form-message">{successMessage}</Alert> : null}

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
                  <Button
                    variant="ghost"
                    iconOnly
                    className="password-visibility"
                    aria-label="Show password"
                    aria-pressed={passwordVisible}
                    onClick={() => setPasswordVisible((visible) => !visible)}
                  >
                    <PasswordIcon visible={passwordVisible} />
                  </Button>
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
                <Button variant="link" size="sm" className="text-button" onClick={() => changeView('forgot-password')}>
                  Forgot password?
                </Button>
              </div>
              <Button variant="primary" size="lg" fullWidth type="submit" loading={isBusy} loadingLabel="Signing in...">
                Sign in <span aria-hidden="true">&#8594;</span>
              </Button>
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
                    <Button
                      variant="ghost"
                      iconOnly
                      className="password-visibility"
                      aria-label="Show password"
                      aria-pressed={passwordVisible}
                      onClick={() => setPasswordVisible((visible) => !visible)}
                    >
                      <PasswordIcon visible={passwordVisible} />
                    </Button>
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
                    <Button
                      variant="ghost"
                      iconOnly
                      className="password-visibility"
                      aria-label="Show confirmation password"
                      aria-pressed={confirmPasswordVisible}
                      onClick={() => setConfirmPasswordVisible((visible) => !visible)}
                    >
                      <PasswordIcon visible={confirmPasswordVisible} />
                    </Button>
                  </span>
                </label>
              </div>
              <Button variant="primary" size="lg" fullWidth type="submit" loading={isBusy} loadingLabel="Creating account...">
                Sign Up <span aria-hidden="true">&#8594;</span>
              </Button>
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
              <Button variant="primary" size="lg" fullWidth type="submit" loading={isBusy} loadingLabel="Sending link...">
                Send reset link <span aria-hidden="true">&#8594;</span>
              </Button>
            </form>
          ) : null}

          <div className="auth-switch">
            {isSignIn ? (
              <p>New to Carpenter Pro? <Button variant="link" size="sm" className="text-button" onClick={() => changeView('sign-up')}>Sign up</Button></p>
            ) : (
                <p>Already have an account? <Button variant="link" size="sm" className="text-button" onClick={() => changeView('sign-in')}>Log in</Button></p>
            )}
          </div>
          <p className="auth-terms">By continuing, you agree to use Carpenter Pro in accordance with your organization's access policies.</p>
        </div>
        
      </section>
    </main>
  )
}

export default AuthPage