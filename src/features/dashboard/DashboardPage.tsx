import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { ApiError } from '../../shared/api/client'
import { creditCostFor } from '../../shared/auth/pricing'
import type { AuthAccount } from '../../shared/auth/types'
import { Mark } from '../../shared/components/Mark'
import { RoomSelect } from '../../shared/components/RoomSelect'
import type { RoomSelection } from '../../shared/components/roomImage'
import { Alert, AnimatedGridPattern, Button, trapFocus } from '../../shared/ui'
import { LibraryDialog } from './components/LibraryDialog'
import { MaterialPill } from './components/MaterialPill'
import { OverviewStat } from './components/OverviewStat'
import {
  createLaminateCollection,
  deleteCollection,
  deleteProduct,
  generateCarpenterRender,
  getLastRenderCost,
  getProduct,
  getShareStats,
  getUserCredits,
  listCarpenterScenes,
  listCollectionProducts,
  listLaminateCollections,
  uploadLaminateProducts,
  type GenerationResult,
  type RoomLibrary,
  type ShareStats,
} from './dashboardService'
import type { Collection, MaterialChoice, MaterialSlot, Product, UploadType } from './dashboardTypes'
import { classifyUpload, fileToMaterial, productToMaterial } from './materials'
import './DashboardPage.css'

type DashboardPageProps = {
  account: AuthAccount
  /** Hidden (but kept mounted) while another view is open, so work in progress survives. */
  hidden?: boolean
  onOpenFiles: () => void
  /** Current balance (owned by the app shell), used to check a render is affordable. */
  credits?: number
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

function creditsLabel(amount: number): string {
  return `${amount} ${amount === 1 ? 'credit' : 'credits'}`
}

function DashboardPage({ account, hidden = false, onOpenFiles, credits, onCreditsChange }: DashboardPageProps) {
  const [primaryMaterial, setPrimaryMaterial] = useState<MaterialChoice | null>(null)
  const [accentMaterial, setAccentMaterial] = useState<MaterialChoice | null>(null)
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)
  // Several images (one render each) or videos; a single image becomes the primary material instead.
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [pendingKind, setPendingKind] = useState<Exclude<UploadType, 'single'>>('multi')
  const [isDropActive, setIsDropActive] = useState(false)
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
  const [renderName, setRenderName] = useState('')
  const [completedRenders, setCompletedRenders] = useState(0)
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null)
  // What the server most recently charged this account for a render, when known. It corrects the
  // tier price below for accounts whose real tier differs (dealers inherit their manufacturer's).
  const [chargedCost, setChargedCost] = useState<number | null>(null)
  // Room step: replaces the upload step inside the composer after Generate. Both steps stay
  // mounted, so the upload and the chosen room survive moving back and forth.
  const [isRoomStepOpen, setIsRoomStepOpen] = useState(false)
  const [roomLibrary, setRoomLibrary] = useState<RoomLibrary | null>(null)
  const [isLoadingRooms, setIsLoadingRooms] = useState(false)
  const [roomsError, setRoomsError] = useState('')
  const uploadStep = useRef<HTMLDivElement>(null)
  const roomStep = useRef<HTMLElement>(null)
  const generateButton = useRef<HTMLButtonElement>(null)
  const roomStepWasOpen = useRef(false)
  const [shareStats, setShareStats] = useState<ShareStats | null>(null)
  const [isOverviewOpen, setIsOverviewOpen] = useState(false)
  const overviewTrigger = useRef<HTMLButtonElement>(null)
  const overviewCollapse = useRef<HTMLButtonElement>(null)
  const overviewWasOpen = useRef(false)
  const uploadInput = useRef<HTMLInputElement>(null)
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
    // An organization member renders at the organization's tier, which their own account record
    // may not show; their last real charge is the better price. Everyone else uses their own tier.
    if (account.role !== 'org_user') return
    const controller = new AbortController()
    getLastRenderCost(account.username, { signal: controller.signal })
      .then((cost) => { if (cost !== null) setChargedCost(cost) })
      .catch(() => undefined)
    return () => controller.abort()
  }, [account.role, account.username])

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

  // Changing step swaps what the composer shows; move focus along with it.
  useEffect(() => {
    if (isRoomStepOpen) {
      roomStepWasOpen.current = true
      roomStep.current?.focus()
    } else if (roomStepWasOpen.current) {
      roomStepWasOpen.current = false
      if (generateButton.current && !generateButton.current.disabled) generateButton.current.focus()
      else uploadStep.current?.focus()
    }
  }, [isRoomStepOpen])

  // Direct upload: the files decide the generation type, there is no type picker.
  const handleUpload = async (files: File[]) => {
    if (!files.length) return
    const selection = classifyUpload(files)
    setGenerationError('')
    if (!selection.ok) {
      setGenerationError(selection.message)
      return
    }

    setRender(null)
    setCompletedRenders(0)
    if (selection.kind === 'single') {
      try {
        setPrimaryMaterial(await fileToMaterial(selection.files[0]))
        setAccentMaterial(null)
        setPendingFiles([])
      } catch (error) {
        setGenerationError(error instanceof Error ? error.message : messageFor(error))
      }
      return
    }
    setPendingFiles(selection.files)
    setPendingKind(selection.kind)
    setPrimaryMaterial(null)
    setAccentMaterial(null)
  }

  const handleUploadSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    void handleUpload(files)
  }

  const handleDropzoneDragOver = (event: DragEvent<HTMLButtonElement>) => {
    if (!canUpload || !event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsDropActive(true)
  }

  const handleDropzoneDrop = (event: DragEvent<HTMLButtonElement>) => {
    if (!canUpload || !event.dataTransfer.files.length) return
    event.preventDefault()
    setIsDropActive(false)
    void handleUpload(Array.from(event.dataTransfer.files))
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

  // What will be generated, derived from the current selection.
  const uploadKind: UploadType | null = pendingFiles.length ? pendingKind : primaryMaterial ? 'single' : null
  const renderCount = uploadKind === 'multi' ? pendingFiles.length : uploadKind === 'single' ? 1 : 0
  // Credits per render: the account's tier price, known as soon as something is selected.
  const generationCost = chargedCost ?? creditCostFor(account.resolution)
  const totalCost = renderCount > 0 ? generationCost * renderCount : null
  const hasInsufficientCredits = totalCost !== null && typeof credits === 'number' && totalCost > credits
  const canGenerate = renderCount > 0 && !hasInsufficientCredits

  const refreshCredits = async () => {
    const remaining = await getUserCredits(account.username).catch(() => null)
    if (typeof remaining === 'number') onCreditsChange(remaining)
  }

  const loadRooms = async () => {
    setIsLoadingRooms(true)
    setRoomsError('')
    try {
      setRoomLibrary(await listCarpenterScenes(account.username))
    } catch (error) {
      setRoomsError(messageFor(error))
    } finally {
      setIsLoadingRooms(false)
    }
  }

  // Generate → choose a room → confirm → render.
  const openRoomStep = () => {
    if (!canGenerate || isGenerating) return
    setGenerationError('')
    setIsRoomStepOpen(true)
    if (!roomLibrary && !isLoadingRooms) void loadRooms()
  }

  const confirmRoom = (room: RoomSelection | null) => {
    setIsRoomStepOpen(false)
    void generateRender(room)
  }

  const generateRender = async (room: RoomSelection | null) => {
    if (!canGenerate || isGenerating) return
    setIsGenerating(true)
    setGenerationError('')
    setCompletedRenders(0)
    let done = 0
    const total = renderCount
    try {
      if (uploadKind === 'multi') {
        // One render per image, in order. Finished images leave the queue, so a retry resumes.
        setBatchProgress({ done: 0, total })
        for (const file of [...pendingFiles]) {
          const material = await fileToMaterial(file)
          const result = await generateCarpenterRender(account.username, material, null, room)
          done += 1
          setRender(result)
          setRenderName(material.name)
          setCompletedRenders(done)
          setBatchProgress({ done, total })
          setPendingFiles((current) => current.filter((item) => item !== file))
          await refreshCredits()
        }
      } else if (primaryMaterial) {
        setRender(await generateCarpenterRender(account.username, primaryMaterial, accentMaterial, room))
        setRenderName(primaryMaterial.name)
        done = 1
        setCompletedRenders(1)
        await refreshCredits()
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : messageFor(error)
      setGenerationError(total > 1 ? `Stopped after ${done} of ${total} renders. ${message}` : message)
      // The server refunds a failed render; show the real balance.
      await refreshCredits()
    } finally {
      setIsGenerating(false)
      setBatchProgress(null)
      // A render just ran: keep the shown price in step with what the server actually charged.
      if (done > 0) {
        void getLastRenderCost(account.username)
          .then((cost) => { if (cost !== null) setChargedCost(cost) })
          .catch(() => undefined)
      }
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
      className={`carpenter-dashboard app-enter-fade ${isOverviewOpen ? 'is-overview-open' : ''} ${isRoomStepOpen ? 'is-room-step' : ''}`}
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
            ref={uploadInput}
            className="file-input-hidden"
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleUploadSelection}
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
          {/* Step 1: upload and configure. Hidden, not unmounted, while a room is being chosen. */}
          <div ref={uploadStep} className="composer-step app-enter" hidden={isRoomStepOpen} tabIndex={-1}>
            <button
              className={`material-dropzone ${canUpload || canBrowseLibrary ? '' : 'is-restricted'} ${isDropActive ? 'is-drop-active' : ''}`}
              type="button"
              disabled={(!canUpload && !canBrowseLibrary) || isGenerating}
              onClick={canUpload ? () => uploadInput.current?.click() : () => void openLibrary('primary')}
              onDragOver={handleDropzoneDragOver}
              onDragLeave={() => setIsDropActive(false)}
              onDrop={handleDropzoneDrop}
            >
              <span className="dropzone-icon"><Mark name={canUpload ? 'upload' : 'folder'} /></span>
              <span className="dropzone-copy">
                <strong>{canUpload
                  ? 'Upload custom artwork / texture'
                  : canBrowseLibrary ? 'Choose from your manufacturer library' : 'Uploads aren’t available for this account'}</strong>
                <small>{canUpload
                  ? uploadKind === 'single' ? '1 image selected · click or drop to replace'
                    : uploadKind === 'multi' ? `${pendingFiles.length} images selected · one render each · click or drop to replace`
                      : uploadKind === 'reel' ? 'Video selected · click or drop to replace'
                        : 'Click or drop here: one image, several images, or a video'
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
                  <strong>{pendingFiles.length} {uploadKind === 'reel' ? 'video' : 'product image'}{pendingFiles.length === 1 ? '' : 's'} selected{uploadKind === 'multi' ? ' · one render each' : ''}</strong>
                  <small>{pendingFiles.slice(0, 2).map((file) => file.name).join(', ')}{pendingFiles.length > 2 ? ` +${pendingFiles.length - 2} more` : ''}</small>
                </span>
                <Button variant="link" size="xs" disabled={isGenerating} onClick={() => setPendingFiles([])}>Clear</Button>
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
                <Button
                  ref={generateButton}
                  variant="primary"
                  size="xs"
                  shape="pill"
                  icon="spark"
                  onClick={openRoomStep}
                  disabled={!canGenerate}
                  loading={isGenerating}
                  loadingLabel={batchProgress ? `Generating ${Math.min(batchProgress.done + 1, batchProgress.total)} of ${batchProgress.total}…` : 'Generating…'}
                  aria-describedby={canGenerate ? undefined : 'generate-requirement'}
                >
                  {totalCost !== null ? `Generate · ${creditsLabel(totalCost)}` : 'Generate'}
                </Button>
              </div>
            </div>
            {/* Why Generate is unavailable; also announced via aria-describedby. */}
            {/* {isGenerating || canGenerate ? null : (
              <p className="generate-requirement" id="generate-requirement">
                {uploadKind === 'reel'
                  ? 'Video generation isn’t available yet. Upload images to create renders.'
                  : hasInsufficientCredits
                    ? `Not enough credits: this needs ${creditsLabel(totalCost ?? 0)} and you have ${credits ?? 0}.${renderCount > 1 ? ' Remove some images to continue.' : ''}`
                    : canUpload
                      ? 'Upload an image or choose a laminate to generate.'
                      : 'Choose a laminate to generate.'}
              </p>
            )} */}
            {generationError ? <Alert tone="error" className="dashboard-message">{generationError}</Alert> : null}
            {isGenerating ? (
              <Alert tone="info" className="dashboard-message">
                {batchProgress
                  ? `Creating render ${Math.min(batchProgress.done + 1, batchProgress.total)} of ${batchProgress.total}. Each can take a few minutes.`
                  : 'Creating your render. This can take a few minutes.'}
              </Alert>
            ) : null}
            {render?.imageUrl && !isGenerating && completedRenders > 0 ? (
              <Alert tone="success" className="dashboard-message">
                {completedRenders === 1 ? 'Your render is ready.' : `${completedRenders} renders are ready.`}{' '}
                <Button variant="link" size="xs" className="dashboard-message-action" onClick={() => setIsOverviewOpen(true)}>
                  {completedRenders === 1 ? 'View render' : 'View latest'}
                </Button>
                {completedRenders > 1 && canOpenFiles ? (
                  <>
                    {' · '}
                    <Button variant="link" size="xs" className="dashboard-message-action" onClick={onOpenFiles}>Open Files</Button>
                  </>
                ) : null}
              </Alert>
            ) : null}
          </div>

          {/* Step 2: choose a room, in place of the upload step. */}
          <RoomSelect
            ref={roomStep}
            hidden={!isRoomStepOpen}
            categories={roomLibrary?.categories ?? []}
            scenes={roomLibrary?.scenes ?? []}
            isLoading={isLoadingRooms}
            error={roomsError}
            onRetry={() => void loadRooms()}
            confirmLabel={totalCost !== null ? `Continue · ${creditsLabel(totalCost)}` : 'Continue'}
            onConfirm={confirmRoom}
            onSkip={() => confirmRoom(null)}
            onBack={() => setIsRoomStepOpen(false)}
          />
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
                  <h3>{renderName || 'Carpenter preview'}</h3>
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