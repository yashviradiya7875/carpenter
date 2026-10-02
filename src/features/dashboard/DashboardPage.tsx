import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { ApiError } from '../../shared/api/client'
import type { AuthAccount } from '../../shared/auth/types'
import { Mark } from '../../shared/components/Mark'
import { Alert, AnimatedGridPattern, Button, trapFocus } from '../../shared/ui'
import { LibraryDialog } from './components/LibraryDialog'
import { MaterialPill } from './components/MaterialPill'
import { OverviewStat } from './components/OverviewStat'
import { UploadOptionsDialog } from './components/UploadOptionsDialog'
import {
  createLaminateCollection,
  deleteCollection,
  deleteProduct,
  generateCarpenterRender,
  getProduct,
  getShareStats,
  getUserCredits,
  listCollectionProducts,
  listLaminateCollections,
  uploadLaminateProducts,
  type GenerationResult,
  type ShareStats,
} from './dashboardService'
import { UPLOAD_TYPES, type Collection, type MaterialChoice, type MaterialSlot, type Product, type UploadType } from './dashboardTypes'
import { fileToMaterial, MAX_MULTI_PRODUCT_FILES, MAX_RENDER_MATERIAL_BYTES, productToMaterial } from './materials'
import './DashboardPage.css'

type DashboardPageProps = {
  account: AuthAccount
  /** Hidden (but kept mounted) while another view is open, so work in progress survives. */
  hidden?: boolean
  onOpenFiles: () => void
  /** Reports the balance after a render spends credits; the global header shows it. */
  onCreditsChange: (credits: number) => void
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

function DashboardPage({ account, hidden = false, onOpenFiles, onCreditsChange }: DashboardPageProps) {
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
  const [selectedLibraryProductId, setSelectedLibraryProductId] = useState<string | null>(null)
  const [selectedLibraryCollectionId, setSelectedLibraryCollectionId] = useState<string>('')
  const [librarySearch, setLibrarySearch] = useState('')
  const [libraryError, setLibraryError] = useState('')
  const [libraryNotice, setLibraryNotice] = useState('')
  const [isLibraryLoading, setIsLibraryLoading] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null)
  const [deletingCollectionId, setDeletingCollectionId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [render, setRender] = useState<GenerationResult | null>(null)
  const [shareStats, setShareStats] = useState<ShareStats | null>(null)
  const [isOverviewOpen, setIsOverviewOpen] = useState(false)
  const overviewTrigger = useRef<HTMLButtonElement>(null)
  const overviewCollapse = useRef<HTMLButtonElement>(null)
  const overviewWasOpen = useRef(false)
  const singleImageInput = useRef<HTMLInputElement>(null)
  const multipleImagesInput = useRef<HTMLInputElement>(null)
  const videoInput = useRef<HTMLInputElement>(null)
  const libraryImageInput = useRef<HTMLInputElement>(null)
  const libraryFolderInput = useRef<HTMLInputElement>(null)

  const capabilities = account.capabilities
  const canUpload = capabilities?.canUploadLaminate === true
  const canBrowseLibrary = Boolean(capabilities?.laminateSource && capabilities.laminateSource !== 'none')
  const canOpenFiles = Boolean(capabilities?.filesAccess && capabilities.filesAccess !== 'none')

  useEffect(() => {
    if (!hidden) document.title = 'Studio · Carpenter Pro'
  }, [hidden])

  useEffect(() => {
    const controller = new AbortController()
    getShareStats(account.username, { signal: controller.signal })
      .then(setShareStats)
      .catch(() => setShareStats(null))
    return () => controller.abort()
  }, [account.username])

  useEffect(() => {
    const folderInput = libraryFolderInput.current
    if (folderInput) {
      const browserFolderInput = folderInput as unknown as {
        webkitdirectory?: string
        directory?: string
      }
      browserFolderInput.webkitdirectory = ''
      browserFolderInput.directory = ''
    }
  }, [])

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

  const addLibraryProducts = async (files: File[], collectionId: string | null) => {
    if (!collectionId) {
      setLibraryError('Create or select a collection before you upload laminates.')
      return
    }

    const uniqueFiles = files.filter((file) => file.type.startsWith('image/') || file.type.length === 0)
    if (!uniqueFiles.length) {
      setLibraryError('Only image files can be added to a laminate collection.')
      return
    }

    try {
      setIsLibraryLoading(true)
      const result = await uploadLaminateProducts(account.username, collectionId, uniqueFiles)

      if (result.collection) {
        setCollections((current) => {
          const existing = current.some((collection) => collection.id === result.collection!.id)
          if (existing) {
            return current.map((collection) => collection.id === result.collection!.id ? { ...collection, ...result.collection! } : collection)
          }
          return [result.collection!, ...current]
        })
      }

      if (activeCollection && activeCollection.id === collectionId) {
        const nextCollection = collections.find((collection) => collection.id === collectionId) ?? activeCollection
        if (nextCollection) {
          await openCollection(nextCollection, librarySearch)
        }
      } else {
        const nextCollection = collections.find((collection) => collection.id === collectionId)
        if (nextCollection) {
          await openCollection(nextCollection, librarySearch)
        }
      }

      setLibraryError('')
    } catch (error) {
      setLibraryError(messageFor(error))
    } finally {
      setIsLibraryLoading(false)
    }
  }

  const createCollection = async () => {
    const collectionName = window.prompt('Name your collection', `Collection ${collections.length + 1}`)
    if (!collectionName) return

    const trimmed = collectionName.trim()
    if (!trimmed) return

    try {
      setIsLibraryLoading(true)
      const collection = await createLaminateCollection(account.username, trimmed)

      setCollections((current) => [collection, ...current])
      setSelectedLibraryCollectionId(collection.id)
      setActiveCollection(collection)
      setProducts([])
      setSelectedLibraryProductId(null)
      setLibraryError('')
    } catch (error) {
      setLibraryError(messageFor(error))
    } finally {
      setIsLibraryLoading(false)
    }
  }

  const handleLibraryImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    void addLibraryProducts(files, activeCollection?.id ?? selectedLibraryCollectionId)
  }

  const handleLibraryFolderUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    void addLibraryProducts(files, activeCollection?.id ?? selectedLibraryCollectionId)
  }

  const openLibrary = async (slot: MaterialSlot, searchOverride = '') => {
    setLibrarySlot(slot)
    setLibraryError('')
    setLibraryNotice('')
    setIsLibraryOpen(true)
    setIsLibraryLoading(true)
    try {
      const nextCollections = await listLaminateCollections(account.username, searchOverride)
      setCollections(nextCollections)
      const firstCollection = nextCollections[0]
      setSelectedLibraryCollectionId(firstCollection?.id ?? '')
      if (firstCollection) {
        setActiveCollection(firstCollection)
        setProducts([])
        await openCollection(firstCollection, searchOverride)
      } else {
        setActiveCollection(null)
        setProducts([])
      }
    } catch (error) {
      setLibraryError(messageFor(error))
    } finally {
      setIsLibraryLoading(false)
    }
  }

  const openCollection = async (collection: Collection, searchOverride = librarySearch) => {
    setSelectedLibraryCollectionId(collection.id)
    setActiveCollection(collection)
    setSelectedLibraryProductId(null)
    setProducts([])
    setLibraryError('')
    setLibraryNotice('')
    setIsLibraryLoading(true)
    try {
      const resultProducts = await listCollectionProducts(account.username, collection.id, searchOverride)
      setProducts(resultProducts)
      if (resultProducts.length) setSelectedLibraryProductId(resultProducts[0].id)
    } catch (error) {
      setLibraryError(messageFor(error))
    } finally {
      setIsLibraryLoading(false)
    }
  }

  const deleteLibraryProduct = async (product: Product): Promise<boolean> => {
    setLibraryError('')
    setLibraryNotice('')
    setDeletingProductId(product.id)

    try {
      await deleteProduct(account.username, product.id)

      const collectionId = activeCollection?.id
      const nextCount = Math.max(0, (activeCollection?.productCount ?? products.length) - 1)
      setProducts((current) => current.filter((item) => item.id !== product.id))
      setCollections((current) => current.map((collection) => collection.id === collectionId
        ? { ...collection, productCount: nextCount }
        : collection))
      setActiveCollection((current) => current && current.id === collectionId
        ? { ...current, productCount: nextCount }
        : current)
      setSelectedLibraryProductId((current) => current === product.id
        ? products.find((item) => item.id !== product.id)?.id ?? null
        : current)
      setLibraryNotice(`${product.name} was deleted.`)
      return true
    } catch (error) {
      setLibraryError(messageFor(error))
      return false
    } finally {
      setDeletingProductId(null)
    }
  }

  const deleteLibraryCollection = async (collection: Collection): Promise<boolean> => {
    setLibraryError('')
    setLibraryNotice('')
    setDeletingCollectionId(collection.id)

    try {
      await deleteCollection(account.username, collection.id)

      const remainingCollections = collections.filter((item) => item.id !== collection.id)
      setCollections(remainingCollections)
      if (activeCollection?.id === collection.id) {
        const nextCollection = remainingCollections[0] ?? null
        setActiveCollection(nextCollection)
        setSelectedLibraryCollectionId(nextCollection?.id ?? '')
        setProducts([])
        setSelectedLibraryProductId(null)
        if (nextCollection) await openCollection(nextCollection, librarySearch)
      }

      setLibraryNotice(`${collection.name} was deleted.`)
      return true
    } catch (error) {
      setLibraryError(messageFor(error))
      return false
    } finally {
      setDeletingCollectionId(null)
    }
  }

  const chooseProduct = async (product: Product) => {
    setLibraryError('')
    setIsLibraryLoading(true)
    try {
      const choice = productToMaterial(await getProduct(account.username, product.id), product)
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
      setRender(await generateCarpenterRender(account.username, primaryMaterial, accentMaterial))
      const remainingCredits = await getUserCredits(account.username).catch(() => null)
      if (typeof remainingCredits === 'number') onCreditsChange(remainingCredits)
    } catch (error) {
      setGenerationError(messageFor(error))
    } finally {
      setIsGenerating(false)
    }
  }

  const dueFollowUps = (shareStats?.followUps?.overdue ?? 0)
    + (shareStats?.followUps?.dueToday ?? 0)
    + (shareStats?.followUps?.upcoming ?? 0)

  const displayedCollections = collections.filter((collection) => {
    const target = librarySearch.trim().toLowerCase()
    if (!target) return true
    return collection.name.toLowerCase().includes(target)
  })

  const displayedProducts = products.filter((product) => {
    const target = librarySearch.trim().toLowerCase()
    if (!target) return true
    return product.name.toLowerCase().includes(target)
  })

  return (
    <main
      className={`carpenter-dashboard app-enter-fade ${isOverviewOpen ? 'is-overview-open' : ''}`}
      hidden={hidden}
      onPointerMove={updateOverviewAtmosphere}
      onPointerLeave={resetOverviewAtmosphere}
    >
      <AnimatedGridPattern className="dashboard-grid" width={44} height={44} numSquares={24} duration={4} />
      <div className="dashboard-content" inert={isOverviewOpen}>
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
          <input
            ref={libraryImageInput}
            className="file-input-hidden"
            type="file"
            accept="image/*"
            multiple
            onChange={handleLibraryImageUpload}
            tabIndex={-1}
          />
          <input
            ref={libraryFolderInput}
            className="file-input-hidden"
            type="file"
            multiple
            onChange={handleLibraryFolderUpload}
            tabIndex={-1}
          />
          <button
            className={`material-dropzone ${canUpload || canBrowseLibrary ? '' : 'is-restricted'}`}
            type="button"
            disabled={!canUpload && !canBrowseLibrary}
            onClick={canUpload ? openUploadOptions : () => void openLibrary('primary')}
          >
            <span className="dropzone-icon"><Mark name={canUpload ? 'upload' : 'folder'} /></span>
            <span className="dropzone-copy">
              <strong>{canUpload
                ? 'Upload custom artwork / texture'
                : canBrowseLibrary ? 'Choose from your manufacturer library' : 'Uploads aren’t available for this account'}</strong>
              <small>{canUpload
                ? selectedUploadType
                  ? `${UPLOAD_TYPES.find((option) => option.id === selectedUploadType)?.title} selected · click to change`
                  : 'Choose single product, multi product, or reel / video'
                : canBrowseLibrary ? 'Browse the laminate collections shared with you' : 'Contact your organization administrator for access.'}</small>
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
            <div className="pending-files-summary app-enter" role="status">
              <span className="pending-files-copy">
                <strong>{pendingFiles.length} {selectedUploadType === 'reel' ? 'video' : 'product image'}{pendingFiles.length === 1 ? '' : 's'} selected</strong>
                <small>{pendingFiles.slice(0, 2).map((file) => file.name).join(', ')}{pendingFiles.length > 2 ? ` +${pendingFiles.length - 2} more` : ''}</small>
              </span>
              <Button variant="link" size="xs" onClick={() => setPendingFiles([])}>Clear</Button>
            </div>
          ) : null}

          <div className="composer-toolbar">
            <div className="composer-shortcuts">
              {canOpenFiles ? (
                <Button variant="ghost" size="xs" shape="pill" icon="folder" onClick={onOpenFiles}>
                  Files
                </Button>
              ) : null}
              <Button variant="ghost" size="xs" shape="pill" icon="qr" disabled title="QR tools will be added in the sharing workflow">
                QR Code
              </Button>
            </div>
            <div className="composer-actions">
              {canBrowseLibrary ? (
                <Button size="xs" shape="pill" icon="image" onClick={() => void openLibrary('primary')}>
                  Browse library
                </Button>
              ) : null}
              {primaryMaterial && canBrowseLibrary ? (
                <Button variant="outline" size="xs" shape="pill" onClick={() => void openLibrary('accent')}>
                  Add accent
                </Button>
              ) : null}
              <Button
                variant="primary"
                size="xs"
                shape="pill"
                icon="spark"
                onClick={() => void generateRender()}
                disabled={selectedUploadType === 'multi' || selectedUploadType === 'reel'}
                loading={isGenerating}
                loadingLabel="Generating…"
                title={selectedUploadType === 'multi' || selectedUploadType === 'reel' ? 'This upload workflow is not connected yet' : undefined}
              >
                Generate
              </Button>
            </div>
          </div>
          {generationError ? <Alert tone="error" className="dashboard-message">{generationError}</Alert> : null}
          {isGenerating ? <Alert tone="info" className="dashboard-message">Creating your render. This can take a few minutes.</Alert> : null}
          {render?.imageUrl && !isGenerating ? (
            <Alert tone="success" className="dashboard-message">
              Your render is ready.{' '}
              <Button variant="link" size="xs" className="dashboard-message-action" onClick={() => setIsOverviewOpen(true)}>View render</Button>
            </Alert>
          ) : null}
        </section>

        <section
          className="overview-panel"
          aria-labelledby="overview-title"
          onPointerMove={updateOverviewAtmosphere}
          onPointerLeave={resetOverviewAtmosphere}
        >
          <header className="overview-header">
            <h2 id="overview-title">Overview</h2>
            <Button
              ref={overviewTrigger}
              variant="ghost"
              size="sm"
              iconOnly
              icon="expand"
              className="overview-toggle"
              aria-label="Expand overview"
              aria-expanded={isOverviewOpen}
              aria-controls="overview-expanded"
              onClick={() => setIsOverviewOpen(true)}
            />
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
          onKeyDown={(event) => {
            if (event.key === 'Tab') trapFocus(event.nativeEvent, event.currentTarget)
          }}
          role="dialog"
          aria-modal={isOverviewOpen}
          aria-labelledby="overview-expanded-title"
          onPointerMove={updateOverviewAtmosphere}
          onPointerLeave={resetOverviewAtmosphere}
        >
          <header className="overview-header overview-expanded-header">
            <h2 id="overview-expanded-title">Overview</h2>
            <Button
              ref={overviewCollapse}
              variant="ghost"
              size="sm"
              iconOnly
              icon="close"
              className="overview-toggle"
              aria-label="Collapse overview"
              onClick={() => setIsOverviewOpen(false)}
              tabIndex={isOverviewOpen ? 0 : -1}
            />
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

      <UploadOptionsDialog
        open={isUploadOptionsOpen}
        selectedUploadType={selectedUploadType}
        onClose={closeUploadOptions}
        onSelect={selectUploadType}
      />

      {isLibraryOpen ? (
        <LibraryDialog
          activeCollection={activeCollection}
          collections={collections}
          displayedCollections={displayedCollections}
          displayedProducts={displayedProducts}
          selectedProductId={selectedLibraryProductId}
          search={librarySearch}
          error={libraryError}
          notice={libraryNotice}
          isLoading={isLibraryLoading}
          deletingProductId={deletingProductId}
          deletingCollectionId={deletingCollectionId}
          onClose={() => setIsLibraryOpen(false)}
          onSearchChange={setLibrarySearch}
          onSelectCollection={(collectionId) => {
            setSelectedLibraryCollectionId(collectionId)
            const collection = collections.find((item) => item.id === collectionId)
            if (collection) void openCollection(collection)
          }}
          onCreateCollection={createCollection}
          onUploadImages={() => libraryImageInput.current?.click()}
          onUploadFolder={() => libraryFolderInput.current?.click()}
          onSelectProduct={setSelectedLibraryProductId}
          onDeleteProduct={deleteLibraryProduct}
          onDeleteCollection={deleteLibraryCollection}
          onConfirm={() => {
            const selectedProduct = displayedProducts.find((product) => product.id === selectedLibraryProductId)
              ?? products.find((product) => product.id === selectedLibraryProductId)
            if (selectedProduct) void chooseProduct(selectedProduct)
          }}
        />
      ) : null}
    </main>
  )
}

export default DashboardPage