import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { ApiError, callApi } from '../../shared/api/client'
import type { AuthAccount } from '../../shared/auth/types'
import './DashboardPage.css'

type MaterialSlot = 'primary' | 'accent'
type UploadType = 'single' | 'multi' | 'reel'
type MaterialChoice = {
  id: string
  name: string
  imageId?: string
  base64?: string
  mimeType?: string
  imageUrl?: string
  source: 'upload' | 'library'
}

type Collection = { id: string; name: string; productCount?: number }
type Product = {
  id: string
  name: string
  thumbUrl?: string
  coverThumbUrl?: string
  imageUrl?: string
}
type ProductDetails = {
  product?: {
    id: string
    name: string
    images?: Array<{ id: string; url?: string; thumbUrl?: string }>
  }
}
type ShareStats = {
  total?: number
  uniqueClients?: number
  followUps?: { overdue?: number; dueToday?: number; upcoming?: number }
}
type GenerationResult = { imageUrl?: string; generationId?: string }
type DashboardPageProps = { account: AuthAccount; onSignOut: () => void }
const MAX_RENDER_MATERIAL_BYTES = 20 * 1024 * 1024
const MAX_MULTI_PRODUCT_FILES = 200
const UPLOAD_TYPES: Array<{ id: UploadType; title: string; description: string; icon: 'image' | 'layers' | 'video' }> = [
  { id: 'single', title: 'Single product', description: 'Create content for one product.', icon: 'image' },
  { id: 'multi', title: 'Multi product', description: 'Work with a group of products.', icon: 'layers' },
  { id: 'reel', title: 'Reel / video', description: 'Create a short-form video.', icon: 'video' },
]

function roleLabel(role: string): string {
  if (role === 'organization') return 'Manufacturer'
  if (role === 'org_user') return 'Sponsored Dealer'
  if (role === 'user') return 'Dealer Pro'
  return role
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'CP'
}

function fileToMaterial(file: File): Promise<MaterialChoice> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error(`Could not read ${file.name}.`))
        return
      }
      const base64 = reader.result.split(',')[1]
      if (!base64) {
        reject(new Error(`Could not read ${file.name}.`))
        return
      }
      resolve({
        id: `${file.name}-${file.lastModified}`,
        name: file.name,
        base64,
        mimeType: file.type || 'image/jpeg',
        imageUrl: reader.result,
        source: 'upload',
      })
    }
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`))
    reader.readAsDataURL(file)
  })
}

function updateOverviewAtmosphere(event: ReactPointerEvent<HTMLElement>): void {
  const bounds = event.currentTarget.getBoundingClientRect()
  const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width))
  const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height))
  event.currentTarget.style.setProperty('--overview-pointer-x', `${(x - 0.5) * 10}px`)
  event.currentTarget.style.setProperty('--overview-pointer-y', `${(y - 0.5) * 8}px`)
  event.currentTarget.style.setProperty('--overview-sheen-position', `${x * 100}%`)
}

function resetOverviewAtmosphere(event: ReactPointerEvent<HTMLElement>): void {
  event.currentTarget.style.setProperty('--overview-pointer-x', '0px')
  event.currentTarget.style.setProperty('--overview-pointer-y', '0px')
  event.currentTarget.style.setProperty('--overview-sheen-position', '50%')
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Something went wrong. Please try again.'
}

function Mark({ name }: { name: 'layers' | 'upload' | 'folder' | 'qr' | 'image' | 'spark' | 'expand' | 'video' | 'close' | 'arrow' | 'back' }) {
  const shapes = {
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    upload: <><path d="M12 16V4m0 0L8 8m4-4 4 4" /><path d="M5 14v5h14v-5" /></>,
    folder: <><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3V7Z" /><path d="M3 10h18" /></>,
    qr: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zm5 0h2m-7 5v2m5-4v4h2" /></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z" /><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" /></>,
    expand: <><path d="M14 4h6v6m0-6-7 7M10 20H4v-6m0 6 7-7" /></>,
    video: <><rect x="3" y="5" width="13" height="14" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    back: <path d="m15 18-6-6 6-6M9 12h12" />,
  }

  return (
    <svg className="dashboard-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {shapes[name]}
    </svg>
  )
}

function Brand() {
  return (
    <span className="dashboard-brand">
      <span className="dashboard-brand-mark"><Mark name="layers" /></span>
      <span>carpenter<span className="dashboard-brand-light">.pro</span></span>
    </span>
  )
}

function DashboardPage({ account, onSignOut }: DashboardPageProps) {
  const [primaryMaterial, setPrimaryMaterial] = useState<MaterialChoice | null>(null)
  const [accentMaterial, setAccentMaterial] = useState<MaterialChoice | null>(null)
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)
  const [isUploadOptionsOpen, setIsUploadOptionsOpen] = useState(false)
  const [selectedUploadType, setSelectedUploadType] = useState<UploadType | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [librarySlot, setLibrarySlot] = useState<MaterialSlot>('primary')
  const [collections, setCollections] = useState<Collection[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [activeCollection, setActiveCollection] = useState<Collection | null>(null)
  const [libraryError, setLibraryError] = useState('')
  const [isLibraryLoading, setIsLibraryLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [render, setRender] = useState<GenerationResult | null>(null)
  const [credits, setCredits] = useState(account.credits)
  const [shareStats, setShareStats] = useState<ShareStats | null>(null)
  const [isOverviewOpen, setIsOverviewOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const overviewTrigger = useRef<HTMLButtonElement>(null)
  const overviewCollapse = useRef<HTMLButtonElement>(null)
  const overviewWasOpen = useRef(false)
  const uploadTrigger = useRef<HTMLButtonElement>(null)
  const uploadDialog = useRef<HTMLElement>(null)
  const uploadDialogWasOpen = useRef(false)
  const singleImageInput = useRef<HTMLInputElement>(null)
  const multipleImagesInput = useRef<HTMLInputElement>(null)
  const videoInput = useRef<HTMLInputElement>(null)

  const capabilities = account.capabilities
  const canUpload = capabilities?.canUploadLaminate === true
  const canBrowseLibrary = Boolean(capabilities?.laminateSource && capabilities.laminateSource !== 'none')
  const canOpenFiles = Boolean(capabilities?.filesAccess && capabilities.filesAccess !== 'none')
  const userName = account.displayName || account.username

  useEffect(() => {
    const controller = new AbortController()
    callApi<ShareStats, { username: string }>(
      'getShareStats',
      { username: account.username },
      { signal: controller.signal },
    )
      .then(setShareStats)
      .catch(() => setShareStats(null))
    return () => controller.abort()
  }, [account.username])

  useEffect(() => {
    if (!isUploadOptionsOpen) {
      if (uploadDialogWasOpen.current) {
        uploadDialogWasOpen.current = false
        uploadTrigger.current?.focus()
      }
      return
    }

    uploadDialogWasOpen.current = true
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsUploadOptionsOpen(false)
    }
    window.addEventListener('keydown', handleEscape)
    window.requestAnimationFrame(() => {
      uploadDialog.current?.querySelector<HTMLButtonElement>('[data-upload-option]')?.focus()
    })
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isUploadOptionsOpen])

  useEffect(() => {
    if (!isOverviewOpen) {
      if (overviewWasOpen.current) {
        overviewWasOpen.current = false
        overviewTrigger.current?.focus()
      }
      return
    }

    overviewWasOpen.current = true
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOverviewOpen(false)
    }
    window.addEventListener('keydown', handleEscape)
    window.requestAnimationFrame(() => overviewCollapse.current?.focus())
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOverviewOpen])

  const openUploadOptions = () => setIsUploadOptionsOpen(true)

  const closeUploadOptions = () => {
    setIsUploadOptionsOpen(false)
  }

  const selectUploadType = (type: UploadType) => {
    setSelectedUploadType(type)
    setPrimaryMaterial(null)
    setAccentMaterial(null)
    setPendingFiles([])
    setGenerationError('')
    setRender(null)
    closeUploadOptions()

    if (type === 'single') singleImageInput.current?.click()
    if (type === 'multi') multipleImagesInput.current?.click()
    if (type === 'reel') videoInput.current?.click()
  }

  const handleSingleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    setGenerationError('')
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setGenerationError('Single product uploads must be an image.')
      return
    }
    if (file.size > MAX_RENDER_MATERIAL_BYTES) {
      setGenerationError('Keep the image size under 20 MB.')
      return
    }

    try {
      setPrimaryMaterial(await fileToMaterial(file))
      setAccentMaterial(null)
      setPendingFiles([])
    } catch (error) {
      setGenerationError(messageFor(error))
    }
  }

  const handleMultipleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    setGenerationError('')
    if (!files.length) return
    if (files.length > MAX_MULTI_PRODUCT_FILES) {
      setGenerationError(`Choose no more than ${MAX_MULTI_PRODUCT_FILES} product images at a time.`)
      return
    }
    const invalidFile = files.find((file) => !file.type.startsWith('image/'))
    if (invalidFile) {
      setGenerationError(`${invalidFile.name} is not an image. Multi product only accepts images.`)
      return
    }
    setPendingFiles(files)
    setPrimaryMaterial(null)
    setAccentMaterial(null)
    setRender(null)
  }

  const handleVideoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    setGenerationError('')
    if (!files.length) return
    const invalidFile = files.find((file) => !file.type.startsWith('video/'))
    if (invalidFile) {
      setGenerationError(`${invalidFile.name} is not a video. Reel / video only accepts video files.`)
      return
    }
    setPendingFiles(files)
    setPrimaryMaterial(null)
    setAccentMaterial(null)
    setRender(null)
  }

  const openLibrary = async (slot: MaterialSlot) => {
    setLibrarySlot(slot)
    setActiveCollection(null)
    setProducts([])
    setLibraryError('')
    setIsLibraryOpen(true)
    setIsLibraryLoading(true)
    try {
      const result = await callApi<{ collections: Collection[] }, {
        username: string; type: string; page: number; pageSize: number; search: string
      }>('listCollections', {
        username: account.username,
        type: 'laminate',
        page: 1,
        pageSize: 40,
        search: '',
      })
      setCollections(result.collections ?? [])
    } catch (error) {
      setLibraryError(messageFor(error))
    } finally {
      setIsLibraryLoading(false)
    }
  }

  const openCollection = async (collection: Collection) => {
    setActiveCollection(collection)
    setProducts([])
    setLibraryError('')
    setIsLibraryLoading(true)
    try {
      const result = await callApi<{ products: Product[] }, {
        username: string; collectionId: string; type: string; page: number; pageSize: number; search: string
      }>('listProducts', {
        username: account.username,
        collectionId: collection.id,
        type: 'laminate',
        page: 1,
        pageSize: 40,
        search: '',
      })
      setProducts(result.products ?? [])
    } catch (error) {
      setLibraryError(messageFor(error))
    } finally {
      setIsLibraryLoading(false)
    }
  }

  const chooseProduct = async (product: Product) => {
    setLibraryError('')
    setIsLibraryLoading(true)
    try {
      const result = await callApi<ProductDetails, { username: string; productId: string }>(
        'getProduct',
        { username: account.username, productId: product.id },
      )
      const image = result.product?.images?.[0]
      if (!result.product || !image) throw new Error('This material does not have a usable image.')
      const choice: MaterialChoice = {
        id: `product-${result.product.id}`,
        name: result.product.name,
        imageId: image.id,
        imageUrl: image.thumbUrl || image.url || product.thumbUrl || product.coverThumbUrl || product.imageUrl,
        source: 'library',
      }
      if (librarySlot === 'primary') setPrimaryMaterial(choice)
      else setAccentMaterial(choice)
      setIsLibraryOpen(false)
    } catch (error) {
      setLibraryError(messageFor(error))
    } finally {
      setIsLibraryLoading(false)
    }
  }

  const generateRender = async () => {
    if (selectedUploadType === 'multi' || selectedUploadType === 'reel') {
      setGenerationError('The selected upload is ready. Its generation workflow will be connected next.')
      return
    }
    if (!primaryMaterial) {
      setGenerationError('Choose or upload a primary laminate to continue.')
      return
    }
    setIsGenerating(true)
    setGenerationError('')
    try {
      const data: Record<string, unknown> = {
        username: account.username,
        scene: {
          name: 'Contemporary interior',
          prompt: '',
        },
        prompt: '',
        creativeMode: false,
        decorateRoom: false,
        aspectRatio: '4:3',
      }
      if (primaryMaterial.imageId) data.laminateImageId = primaryMaterial.imageId
      else {
        data.laminateBase64 = primaryMaterial.base64
        data.laminateMimeType = primaryMaterial.mimeType
      }
      if (accentMaterial?.imageId) data.accentLaminateImageId = accentMaterial.imageId
      else if (accentMaterial?.base64) {
        data.accentLaminateBase64 = accentMaterial.base64
        data.accentLaminateMimeType = accentMaterial.mimeType
      }
      const result = await callApi<GenerationResult, Record<string, unknown>>('generateCarpenter', data)
      setRender(result)
      const creditResult = await callApi<{ credits: number }, { username: string }>(
        'getUserCredits',
        { username: account.username },
      ).catch(() => null)
      if (typeof creditResult?.credits === 'number') setCredits(creditResult.credits)
    } catch (error) {
      setGenerationError(messageFor(error))
    } finally {
      setIsGenerating(false)
    }
  }

  const dueFollowUps = (shareStats?.followUps?.overdue ?? 0)
    + (shareStats?.followUps?.dueToday ?? 0)
    + (shareStats?.followUps?.upcoming ?? 0)

  return (
    <main
      className="carpenter-dashboard"
      onPointerMove={updateOverviewAtmosphere}
      onPointerLeave={resetOverviewAtmosphere}
    >
      <header className="dashboard-topbar">
        <Brand />
        <div className="dashboard-topbar-actions">
          {typeof credits === 'number' ? (
            <div className="credit-balance"><Mark name="spark" /><span>{credits}</span><span>Credits left</span></div>
          ) : null}
          <div className="profile-control">
            <button
              className="profile-trigger"
              type="button"
              aria-label="Open account menu"
              aria-expanded={isProfileOpen}
              onClick={() => setIsProfileOpen((open) => !open)}
            >
              <span>{initials(userName)}</span>
            </button>
            {isProfileOpen ? (
              <div className="profile-menu">
                <strong>{userName}</strong>
                <span>{roleLabel(account.role)}</span>
                <button type="button" onClick={onSignOut}>Sign out</button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="dashboard-content">
        <section className="workspace-intro" aria-labelledby="workspace-title">
          <h1 id="workspace-title">Bring your laminates to life.</h1>
          <p>Turn a material into a space your clients can imagine.</p>
        </section>

        <section className="workspace-composer" aria-label="Common workspace">
          <input
            ref={singleImageInput}
            className="file-input-hidden"
            type="file"
            accept="image/*"
            onChange={handleSingleImageUpload}
            tabIndex={-1}
          />
          <input
            ref={multipleImagesInput}
            className="file-input-hidden"
            type="file"
            accept="image/*"
            multiple
            onChange={handleMultipleImageUpload}
            tabIndex={-1}
          />
          <input
            ref={videoInput}
            className="file-input-hidden"
            type="file"
            accept="video/*"
            multiple
            onChange={handleVideoUpload}
            tabIndex={-1}
          />
          <button
            ref={uploadTrigger}
            className={`material-dropzone ${canUpload ? '' : 'is-restricted'}`}
            type="button"
            disabled={!canUpload}
            onClick={openUploadOptions}
          >
            <span className="dropzone-icon"><Mark name={canUpload ? 'upload' : 'folder'} /></span>
            <span className="dropzone-copy">
              <strong>{canUpload ? 'Upload custom artwork / texture' : 'Choose from your manufacturer library'}</strong>
              <small>{canUpload
                ? selectedUploadType
                  ? `${UPLOAD_TYPES.find((option) => option.id === selectedUploadType)?.title} selected · click to change`
                  : 'Choose single product, multi product, or reel / video'
                : 'Uploads are restricted for this account'}</small>
            </span>
          </button>

          {(primaryMaterial || accentMaterial) ? (
            <div className="selected-materials" aria-live="polite">
              {primaryMaterial ? (
                <MaterialPill label="Primary" material={primaryMaterial} onRemove={() => setPrimaryMaterial(null)} />
              ) : null}
              {accentMaterial ? (
                <MaterialPill label="Accent" material={accentMaterial} onRemove={() => setAccentMaterial(null)} />
              ) : null}
            </div>
          ) : null}

          {pendingFiles.length ? (
            <div className="pending-files-summary" role="status">
              <span className="pending-files-copy">
                <strong>{pendingFiles.length} {selectedUploadType === 'reel' ? 'video' : 'product image'}{pendingFiles.length === 1 ? '' : 's'} selected</strong>
                <small>{pendingFiles.slice(0, 2).map((file) => file.name).join(', ')}{pendingFiles.length > 2 ? ` +${pendingFiles.length - 2} more` : ''}</small>
              </span>
              <button type="button" onClick={() => setPendingFiles([])}>Clear</button>
            </div>
          ) : null}

          <div className="composer-toolbar">
            <div className="composer-shortcuts">
              {canOpenFiles ? (
                <button className="utility-button" type="button" disabled title="Files workspace will be added in the next workflow step">
                  <Mark name="folder" /> Files
                </button>
              ) : null}
              <button className="utility-button" type="button" disabled title="QR tools will be added in the sharing workflow">
                <Mark name="qr" /> QR Code
              </button>
            </div>
            <div className="composer-actions">
              {canBrowseLibrary ? (
                <button className="browse-button" type="button" onClick={() => void openLibrary('primary')}>
                  <Mark name="image" /> Browse library
                </button>
              ) : null}
              {primaryMaterial && canBrowseLibrary ? (
                <button className="accent-pick-button" type="button" onClick={() => void openLibrary('accent')}>
                  Add accent
                </button>
              ) : null}
              <button
                className="generate-button"
                type="button"
                onClick={() => void generateRender()}
                disabled={isGenerating || selectedUploadType === 'multi' || selectedUploadType === 'reel'}
                title={selectedUploadType === 'multi' || selectedUploadType === 'reel' ? 'This upload workflow is not connected yet' : undefined}
              >
                <Mark name="spark" /> {isGenerating ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </div>
          {generationError ? <p className="dashboard-message" role="alert">{generationError}</p> : null}
          {isGenerating ? <p className="generation-status" role="status">Creating your render. This can take a few minutes.</p> : null}
        </section>

        <section
          className="overview-panel"
          aria-labelledby="overview-title"
          onPointerMove={updateOverviewAtmosphere}
          onPointerLeave={resetOverviewAtmosphere}
        >
          <header className="overview-header">
            <h2 id="overview-title">Overview</h2>
            <button
              ref={overviewTrigger}
              className="overview-toggle"
              type="button"
              aria-label="Expand overview"
              aria-expanded={isOverviewOpen}
              aria-controls="overview-expanded"
              onClick={() => setIsOverviewOpen(true)}
            >
              <Mark name="expand" />
            </button>
          </header>
        </section>
      </div>

      <div
        className={`overview-overlay ${isOverviewOpen ? 'is-open' : ''}`}
        aria-hidden={!isOverviewOpen}
        inert={!isOverviewOpen}
      >
        <section
          className="overview-expanded"
          id="overview-expanded"
          role="dialog"
          aria-modal={isOverviewOpen}
          aria-labelledby="overview-expanded-title"
          onPointerMove={updateOverviewAtmosphere}
          onPointerLeave={resetOverviewAtmosphere}
        >
          <header className="overview-header overview-expanded-header">
            <h2 id="overview-expanded-title">Overview</h2>
            <button
              ref={overviewCollapse}
              className="overview-toggle overview-collapse"
              type="button"
              aria-label="Collapse overview"
              onClick={() => setIsOverviewOpen(false)}
              tabIndex={isOverviewOpen ? 0 : -1}
            >
              <Mark name="close" />
            </button>
          </header>
          <div className="overview-body">
            <div className="overview-stats">
              <OverviewStat label="Share attempts" value={shareStats ? String(shareStats.total ?? 0) : '—'} />
              <OverviewStat label="Clients" value={shareStats ? String(shareStats.uniqueClients ?? 0) : '—'} />
              <OverviewStat label="Follow-ups" value={shareStats ? String(dueFollowUps) : '—'} />
            </div>
            {render?.imageUrl ? (
              <article className="render-result">
                <div className="render-result-copy">
                  <span>LATEST RENDER</span>
                  <h3>{primaryMaterial?.name || 'Carpenter preview'}</h3>
                  <p>{render.generationId ? `Render ${render.generationId}` : 'Your generated scene'}</p>
                </div>
                <img src={render.imageUrl} alt="Your generated Carpenter material preview" />
              </article>
            ) : (
              <p className="overview-empty">Your recent renders and client activity will appear here.</p>
            )}
          </div>
        </section>
      </div>

      {isUploadOptionsOpen ? (
        <div className="upload-options-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeUploadOptions()
        }}>
          <section
            className="upload-options-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-options-title"
            ref={uploadDialog}
          >
            <header className="upload-options-header">
              <div>
                <span className="upload-options-kicker">COMMON WORKSPACE</span>
                <h2 id="upload-options-title">Choose an upload type</h2>
                <p>Select a workflow to continue.</p>
              </div>
              <button
                className="upload-options-close"
                type="button"
                aria-label="Close upload options"
                onClick={closeUploadOptions}
              >
                <Mark name="close" />
              </button>
            </header>
            <div className="upload-option-list">
              {UPLOAD_TYPES.map((option) => (
                <button
                  className={`upload-option ${selectedUploadType === option.id ? 'is-selected' : ''}`}
                  type="button"
                  key={option.id}
                  data-upload-option
                  aria-pressed={selectedUploadType === option.id}
                  onClick={() => selectUploadType(option.id)}
                >
                  <span className="upload-option-icon"><Mark name={option.icon} /></span>
                  <span className="upload-option-copy"><strong>{option.title}</strong><small>{option.description}</small></span>
                  <Mark name="arrow" />
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {isLibraryOpen ? (
        <div className="library-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsLibraryOpen(false)
        }}>
          <section className="library-dialog" role="dialog" aria-modal="true" aria-labelledby="library-title">
            <header className="library-header">
              <div>
                {activeCollection ? (
                  <button className="library-back" type="button" onClick={() => {
                    setActiveCollection(null)
                    setProducts([])
                  }}><Mark name="back" /> Collections</button>
                ) : <span className="library-kicker">ACCESSIBLE MATERIALS</span>}
                <h2 id="library-title">{activeCollection?.name || 'Laminate library'}</h2>
                <p>{activeCollection ? 'Choose a product for this render.' : 'Collections available to your account.'}</p>
              </div>
              <button className="library-close" type="button" aria-label="Close library" onClick={() => setIsLibraryOpen(false)}>
                <Mark name="close" />
              </button>
            </header>
            {libraryError ? <p className="library-error" role="alert">{libraryError}</p> : null}
            {isLibraryLoading ? (
              <div className="library-loading" role="status"><span className="loading-indicator" /> Loading materials…</div>
            ) : activeCollection ? (
              products.length ? (
                <div className="library-grid">
                  {products.map((product) => (
                    <button className="library-product" type="button" key={product.id} onClick={() => void chooseProduct(product)}>
                      {product.thumbUrl || product.coverThumbUrl || product.imageUrl ? (
                        <img src={product.thumbUrl || product.coverThumbUrl || product.imageUrl} alt="" />
                      ) : <span className="product-placeholder"><Mark name="image" /></span>}
                      <span>{product.name}</span>
                      <small>Use as {librarySlot}</small>
                    </button>
                  ))}
                </div>
              ) : <p className="library-empty">No products in this collection yet.</p>
            ) : collections.length ? (
              <div className="collection-list">
                {collections.map((collection) => (
                  <button className="collection-row" type="button" key={collection.id} onClick={() => void openCollection(collection)}>
                    <span className="collection-mark"><Mark name="folder" /></span>
                    <span><strong>{collection.name}</strong><small>{collection.productCount ?? 0} materials</small></span>
                    <Mark name="arrow" />
                  </button>
                ))}
              </div>
            ) : <p className="library-empty">No laminate collections are available for this account.</p>}
          </section>
        </div>
      ) : null}
    </main>
  )
}

function MaterialPill({ label, material, onRemove }: { label: string; material: MaterialChoice; onRemove: () => void }) {
  return (
    <div className="material-pill">
      {material.imageUrl ? <img src={material.imageUrl} alt="" /> : <span className="material-pill-placeholder"><Mark name="image" /></span>}
      <span><small>{label} material</small><strong>{material.name}</strong></span>
      <button type="button" aria-label={`Remove ${label.toLowerCase()} material`} onClick={onRemove}><Mark name="close" /></button>
    </div>
  )
}

function OverviewStat({ label, value }: { label: string; value: string }) {
  return <div className="overview-stat"><span>{label}</span><strong>{value}</strong></div>
}

export default DashboardPage