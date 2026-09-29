import { useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import './DashboardDemo.css'

type MarketRole = 'organization' | 'user' | 'org_user'
type ProductRole = 'Manufacturer' | 'Dealer Pro' | 'Sponsored Dealer'

type CapabilitySet = {
  canUploadLaminate: boolean
  laminateSource: 'own' | 'files_or_upload' | 'sponsor_library'
  filesAccess: 'full' | 'laminates' | 'none'
  canShare: boolean
  canDownload: boolean
  canSaveToFiles: boolean
  reel: 'button_only'
  activity: 'full_reopen_download' | 'history_only'
  brandingStrip: boolean
  canSeeDealerNotes: boolean
  launchCards: ['single', 'multi']
}

type SessionUser = {
  email: string
  role: ProductRole
}

const ROLE_DETAILS: Record<ProductRole, { role: MarketRole; capabilities: CapabilitySet }> = {
  Manufacturer: {
    role: 'organization',
    capabilities: {
      canUploadLaminate: true,
      laminateSource: 'own',
      filesAccess: 'full',
      canShare: true,
      canDownload: true,
      canSaveToFiles: true,
      reel: 'button_only',
      activity: 'full_reopen_download',
      brandingStrip: false,
      canSeeDealerNotes: false,
      launchCards: ['single', 'multi'],
    },
  },
  'Dealer Pro': {
    role: 'user',
    capabilities: {
      canUploadLaminate: true,
      laminateSource: 'files_or_upload',
      filesAccess: 'laminates',
      canShare: true,
      canDownload: false,
      canSaveToFiles: false,
      reel: 'button_only',
      activity: 'history_only',
      brandingStrip: false,
      canSeeDealerNotes: true,
      launchCards: ['single', 'multi'],
    },
  },
  'Sponsored Dealer': {
    role: 'org_user',
    capabilities: {
      canUploadLaminate: false,
      laminateSource: 'sponsor_library',
      filesAccess: 'none',
      canShare: true,
      canDownload: false,
      canSaveToFiles: false,
      reel: 'button_only',
      activity: 'history_only',
      brandingStrip: true,
      canSeeDealerNotes: true,
      launchCards: ['single', 'multi'],
    },
  },
}

const DEMO_USERS: Record<ProductRole, { email: string; password: string }> = {
  Manufacturer: { email: 'manufacturer@carpenter.pro', password: 'demo123' },
  'Dealer Pro': { email: 'dealer@carpenter.pro', password: 'demo123' },
  'Sponsored Dealer': { email: 'sponsored@carpenter.pro', password: 'demo123' },
}

const MATERIALS = [
  { id: 'walnut-101', name: 'Walnut 101', family: 'Natural wood', color: '#805b43' },
  { id: 'smoked-oak', name: 'Smoked Oak', family: 'Natural wood', color: '#594b43' },
  { id: 'ivory-stone', name: 'Ivory Stone', family: 'Mineral', color: '#c5bbaa' },
  { id: 'sage-matte', name: 'Sage Matte', family: 'Solid color', color: '#728174' },
]

type IconName = 'spark' | 'upload' | 'image' | 'grid' | 'folder' | 'qr' | 'arrow' | 'close' | 'check' | 'eye' | 'share' | 'download' | 'clock' | 'user' | 'chevron' | 'layers' | 'plus' | 'settings' | 'copy'

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    spark: (
      <>
        <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z" />
        <path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4m0 0L8 8m4-4 4 4" />
        <path d="M5 14v5h14v-5" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9" r="1.5" />
        <path d="m21 15-5-5L5 20" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    folder: (
      <>
        <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9H3V7Z" />
        <path d="M3 10h18" />
      </>
    ),
    qr: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <path d="M14 14h3v3h-3zm5 0h2m-7 5v2m5-4v4h2" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    check: <path d="m5 12 4 4L19 6" />,
    eye: (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    share: (
      <>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.7 10.7 6.6-4.4m-6.6 7 6.6 4.4" />
      </>
    ),
    download: (
      <>
        <path d="M12 4v11m0 0 4-4m-4 4-4-4" />
        <path d="M5 19h14" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </>
    ),
    chevron: <path d="m7 10 5 5 5-5" />,
    layers: (
      <>
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
      </>
    ),
    plus: <path d="M12 5v14m-7-7h14" />,
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.6.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.6-.9l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.9l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.6-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.6.9l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1-.1 1.9Z" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
      </>
    ),
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

function App() {
  const [session, setSession] = useState<SessionUser | null>(null)
  const [form, setForm] = useState({
    email: 'manufacturer@carpenter.pro',
    password: 'demo123',
    role: 'Manufacturer' as ProductRole,
  })
  const [error, setError] = useState('')
  const [selectedMaterial, setSelectedMaterial] = useState(MATERIALS[0])
  const [notice, setNotice] = useState('')
  const [generated, setGenerated] = useState(false)

  const roleDetails = useMemo(() => session ? ROLE_DETAILS[session.role] : ROLE_DETAILS[form.role], [session, form.role])
  const capabilities = roleDetails.capabilities

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setError('')
  }

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const user = DEMO_USERS[form.role]
    if (!user || form.email.trim().toLowerCase() !== user.email || form.password !== user.password) {
      setError('Use the demo credentials for the selected role to continue.')
      return
    }

    setSession({ email: user.email, role: form.role })
    setError('')
    setNotice('')
  }

  const handleLogout = () => {
    setSession(null)
    setNotice('')
  }

  const handleGenerate = () => {
    if (!capabilities.canUploadLaminate && !capabilities.laminateSource) {
      setNotice('This role does not have upload access. Please choose an approved sponsor material.')
      return
    }

    setGenerated(true)
    setNotice(`${session?.role ?? form.role} workspace is ready.`)
  }

  if (!session) {
    return (
      <div className="app-shell auth-shell">
        <div className="login-wrap">
          <header className="login-header">
            <div className="brand-lockup">
              <span className="brand-mark">
                <Icon name="layers" size={18} />
              </span>
              <span>carpenter<span className="wordmark-light">.pro</span></span>
            </div>
          </header>

          <main className="login-panel">
            <h1>Bring your laminates to life.</h1>
            <p className="login-subtitle">Turn a material into a space your clients can imagine.</p>

            <form className="login-form" onSubmit={handleLogin}>
              <label className="field-block">
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleInputChange}
                  placeholder="name@company.com"
                />
              </label>

              <label className="field-block">
                <span>Password</span>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleInputChange}
                  placeholder="Enter password"
                />
              </label>

              <label className="field-block">
                <span>Role</span>
                <select name="role" value={form.role} onChange={handleInputChange}>
                  <option value="Manufacturer">Manufacturer</option>
                  <option value="Dealer Pro">Dealer Pro</option>
                  <option value="Sponsored Dealer">Manufacturer-Sponsored Dealer</option>
                </select>
              </label>

              {error ? <p className="error-banner">{error}</p> : null}

              <div className="demo-row">
                <span>Demo login</span>
                <strong>{form.role}</strong>
              </div>

              <button className="primary-button" type="submit">
                <Icon name="spark" size={15} />
                Sign in
              </button>
            </form>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell dashboard-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">
            <Icon name="layers" size={18} />
          </span>
          <span>carpenter<span className="wordmark-light">.pro</span></span>
        </div>

        <nav className="top-nav" aria-label="Main navigation">
          <a className="nav-active" href="#workspace">Workspace</a>
          <a href="#overview">Overview</a>
          <a href="#activity">Activity</a>
        </nav>

        <div className="topbar-tools">
          <span className="credits">
            <Icon name="spark" size={13} />
            <b>140</b> credits
          </span>
          <button className="avatar-button" aria-label="User profile">
            <span>{session.role.slice(0, 2).toUpperCase()}</span>
          </button>
        </div>
      </header>

      <main className="workspace-shell" id="workspace">
        <section className="hero-panel">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-line" />
              {session.role}
              <span className="eyebrow-line" />
            </div>
            <h1>Bring your laminates to life.</h1>
            <p>Welcome back, {session.email}.</p>
          </div>

          <div className="composer-card">
            <div className="composer-header">
              <div>
                <strong>Start with a material</strong>
                <small>Role access is locked to {session.role}.</small>
              </div>
              <span className="role-pill">{session.role}</span>
            </div>

            <div className="upload-box">
              <div className="upload-icon">
                <Icon name={capabilities.canUploadLaminate ? 'upload' : 'folder'} size={16} />
              </div>
              <div className="upload-copy">
                <strong>
                  {capabilities.canUploadLaminate ? 'Upload custom laminate' : 'Sponsor library access only'}
                </strong>
                <small>
                  {capabilities.canUploadLaminate
                    ? 'Use a texture from your local library.'
                    : 'This role can only use manufacturer-approved materials.'}
                </small>
              </div>
            </div>

            <button
              className="selected-material"
              type="button"
              onClick={() => {
                const currentIndex = MATERIALS.findIndex((material) => material.id === selectedMaterial.id)
                const nextMaterial = MATERIALS[(currentIndex + 1) % MATERIALS.length]
                setSelectedMaterial(nextMaterial)
                setNotice(`Material switched to ${nextMaterial.name}.`)
              }}
            >
              <span className="material-swatch" style={{ background: selectedMaterial.color }} />
              <span className="material-label">
                <small>SELECTED MATERIAL</small>
                <strong>{selectedMaterial.name}</strong>
                <em>{selectedMaterial.family}</em>
              </span>
              <span className="change-material">Open library</span>
            </button>

            <div className="toolbar-row">
              <div className="toolbar-left">
                <button type="button" className="ghost-button"><Icon name="folder" size={14} /> Files</button>
                <button type="button" className="ghost-button"><Icon name="qr" size={14} /> QR Code</button>
              </div>

              <button type="button" className="ghost-button" onClick={handleLogout}>Logout</button>
            </div>

            <div className="action-row">
              <button type="button" className="secondary-button" onClick={() => setNotice('Browse library is available to the current role.') }>
                <Icon name="grid" size={14} /> Browse library
              </button>
              <button type="button" className="primary-button" onClick={handleGenerate}>
                <Icon name="spark" size={15} /> Generate
              </button>
            </div>
          </div>
        </section>

        {notice ? <p className="notice" role="status">{notice}</p> : null}

        <section className="preview-panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">YOUR WORKSPACE</span>
              <h2>{generated ? 'Rendered scene ready' : 'Ready for your first render'}</h2>
            </div>
            <div className="mini-actions">
              {capabilities.canDownload ? <button type="button" className="icon-button"><Icon name="download" size={14} /></button> : null}
              {capabilities.canShare ? <button type="button" className="icon-button"><Icon name="share" size={14} /></button> : null}
            </div>
          </div>

          <div className="render-surface">
            {generated ? (
              <>
                <img
                  src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80"
                  alt="Room preview"
                />
                {capabilities.brandingStrip ? (
                  <div className="branding-strip">
                    <span className="brand-avatar">A</span>
                    <strong>Acme Materials</strong>
                    <span>{selectedMaterial.name}</span>
                    <small>powered by Surus Studio</small>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="empty-preview">
                <div className="empty-scene" aria-hidden="true">
                  <div className="window" />
                  <div className="bench" />
                  <div className="plant" />
                </div>
                <p>Your generated room preview will appear here.</p>
              </div>
            )}
          </div>
        </section>

        <section className="access-panel" id="overview">
          <div className="panel-header small-header">
            <div>
              <span className="section-kicker">ROLE GATES</span>
              <h2>Access summary</h2>
            </div>
          </div>

          <div className="access-grid">
            <article className="info-card">
              <span className="card-label">Role</span>
              <h3>{session.role}</h3>
              <p>
                {session.role === 'Manufacturer' && 'Full workspace access with full Drive capability and upload rights.'}
                {session.role === 'Dealer Pro' && 'Can create and share laminate previews, but downloads and file saves are restricted.'}
                {session.role === 'Sponsored Dealer' && 'Uses sponsor library only. Upload and file-system access are restricted.'}
              </p>
            </article>

            <article className="info-card">
              <span className="card-label">Capability matrix</span>
              <ul className="capability-list">
                <li><span>Upload laminate</span><strong>{String(capabilities.canUploadLaminate)}</strong></li>
                <li><span>Share</span><strong>{String(capabilities.canShare)}</strong></li>
                <li><span>Download</span><strong>{String(capabilities.canDownload)}</strong></li>
                <li><span>Save to files</span><strong>{String(capabilities.canSaveToFiles)}</strong></li>
              </ul>
            </article>

            <article className="info-card">
              <span className="card-label">Files access</span>
              <h3>{capabilities.filesAccess}</h3>
              <p>{capabilities.laminateSource === 'sponsor_library' ? 'Read-only sponsor materials.' : 'Material access is open for the current role.'}</p>
            </article>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
