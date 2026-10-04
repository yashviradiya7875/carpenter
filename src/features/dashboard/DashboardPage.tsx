import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { ApiError } from '../../shared/api/client'
import { creditCostFor } from '../../shared/auth/pricing'
import type { AuthAccount } from '../../shared/auth/types'
import { Mark } from '../../shared/components/Mark'
import { MaterialPlacement, type PlacementArea } from '../../shared/components/MaterialPlacement'
import { RoomSelect } from '../../shared/components/RoomSelect'
import { isSameRoom, roomImageUrl, type RoomSelection } from '../../shared/components/roomImage'
import { Alert, AnimatedGridPattern, Button, trapFocus } from '../../shared/ui'
import { GenerationStage, type GenerationStageView, type ResultNotice } from './components/GenerationStage'
import { LibraryDialog } from './components/LibraryDialog'
import { MaterialPill } from './components/MaterialPill'
import { OverviewStat } from './components/OverviewStat'
import { ShareDialog, type ShareDraft } from './components/ShareDialog'
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
  listShareClients,
  recordShareAttempt,
  roomName,
  saveRenderToFiles,
  uploadLaminateProducts,
  type GenerationResult,
  type RoomLibrary,
  type ShareClient,
  type ShareStats,
} from './dashboardService'
import type { Collection, MaterialChoice, MaterialSlot, PlacementPlan, Product, UploadType } from './dashboardTypes'
import { classifyUpload, fileToMaterial, materialLabel, planPlacement, productToMaterial } from './materials'
import { deliverShare, downloadImage, hasShareSheet, sourceTextureUrl } from './renderActions'
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
  // Two uploaded images are used together in one render; kept so they can be rendered separately instead.
  const [pairFiles, setPairFiles] = useState<File[] | null>(null)
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
  // What the latest render was made from; Save to Files stores the laminate beside the render.
  const [renderSource, setRenderSource] = useState<{ material: MaterialChoice; sceneName: string; seconds: number } | null>(null)
  // Result actions: download, save to Files, share.
  const [isDownloading, setIsDownloading] = useState(false)
  const [isSavingToFiles, setIsSavingToFiles] = useState(false)
  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null)
  const [resultNotice, setResultNotice] = useState<ResultNotice | null>(null)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [shareClients, setShareClients] = useState<ShareClient[]>([])
  const [isLoadingShareClients, setIsLoadingShareClients] = useState(false)
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
  // Generation stage: takes over the content area once a room is confirmed, and stays for the
  // result or error until the user returns to the studio.
  const [isStageRequested, setIsStageRequested] = useState(false)
  const lastRoom = useRef<RoomSelection | null>(null)
  const lastPlan = useRef<PlacementPlan | null>(null)
  // Placement step: with two materials on a real room photo, mark where each goes before rendering.
  // It stays mounted for its room, so the marked areas survive going back; a new room starts it over.
  const [placementRoom, setPlacementRoom] = useState<RoomSelection | null>(null)
  const [isPlacementOpen, setIsPlacementOpen] = useState(false)
  const [placementKey, setPlacementKey] = useState(0)
  // Re-configure: back from the result to the last configuration step, where Back returns to the result.
  const [isReconfiguring, setIsReconfiguring] = useState(false)
  const placementStep = useRef<HTMLElement>(null)
  const uploadStep = useRef<HTMLDivElement>(null)
  const roomStep = useRef<HTMLElement>(null)
  const stage = useRef<HTMLElement>(null)
  const generateButton = useRef<HTMLButtonElement>(null)
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
  // Result actions follow the account's capabilities, as the API also enforces them.
  const canDownload = capabilities?.canDownload === true
  const canSaveToFiles = capabilities?.canSaveToFiles === true
  const canShare = capabilities?.canShare !== false
  const canUseShareSheet = capabilities?.share?.deviceShare !== false
  const canCopyShare = capabilities?.share?.copyMessageFallback !== false

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

  const stageView: GenerationStageView | null = isGenerating ? 'loading'
    : generationError ? 'error'
      : render?.imageUrl && completedRenders > 0 ? 'result' : null
  const isStageOpen = isStageRequested && stageView !== null
  // What the content area shows: the upload, room or placement step, or one state of the stage.
  const contentView = isStageOpen ? `stage:${stageView}` : isPlacementOpen ? 'placement' : isRoomStepOpen ? 'room' : 'upload'
  const previousContentView = useRef(contentView)

  // Changing view swaps what the content area shows; move focus along with it.
  useEffect(() => {
    const previous = previousContentView.current
    if (previous === contentView) return
    previousContentView.current = contentView
    if (contentView.startsWith('stage')) {
      // Between stage states, leave focus alone if the user has moved elsewhere (e.g. the header).
      const active = document.activeElement
      const isElsewhere = active && active !== document.body && !stage.current?.contains(active)
      if (!previous.startsWith('stage') || !isElsewhere) stage.current?.focus()
    } else if (contentView === 'room') {
      roomStep.current?.focus()
    } else if (contentView === 'placement') {
      placementStep.current?.focus()
    } else if (generateButton.current && !generateButton.current.disabled) {
      generateButton.current.focus()
    } else {
      uploadStep.current?.focus()
    }
  }, [contentView])

  // Two images as the two materials of one render.
  const combinePair = async (files: File[]) => {
    try {
      const [first, second] = await Promise.all(files.map(fileToMaterial))
      setPrimaryMaterial(first)
      setAccentMaterial(second)
      setPendingFiles([])
      setPairFiles(files)
      setPlacementRoom(null)
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : messageFor(error))
    }
  }

  // The same two images as two renders, one material each.
  const separatePair = () => {
    if (!pairFiles) return
    setPendingFiles(pairFiles)
    setPendingKind('multi')
    setPrimaryMaterial(null)
    setAccentMaterial(null)
  }

  // Removing the first of two materials leaves the second as the only one.
  const removeMaterial = (slot: MaterialSlot) => {
    if (slot === 'primary') setPrimaryMaterial(accentMaterial)
    setAccentMaterial(null)
    setPairFiles(null)
  }

  // Direct upload: the files decide the generation type, there is no type picker.
  const handleUpload = async (files: File[]) => {
    if (!files.length) return
    const selection = classifyUpload(files)
    // A new upload starts over in the studio; its validation errors belong there, not on the stage.
    setIsStageRequested(false)
    setIsReconfiguring(false)
    setGenerationError('')
    if (!selection.ok) {
      setGenerationError(selection.message)
      return
    }

    setRender(null)
    setCompletedRenders(0)
    setPlacementRoom(null)
    if (selection.kind === 'single') {
      try {
        setPrimaryMaterial(await fileToMaterial(selection.files[0]))
        setAccentMaterial(null)
        setPendingFiles([])
        setPairFiles(null)
      } catch (error) {
        setGenerationError(error instanceof Error ? error.message : messageFor(error))
      }
      return
    }
    // Exactly two images: both materials go into one render.
    if (selection.kind === 'multi' && selection.files.length === 2) {
      await combinePair(selection.files)
      return
    }
    setPairFiles(null)
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
      setPairFiles(null)
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

  // Shown on a step's confirm action, which stays disabled, instead of failing silently.
  const generateBlockedReason = hasInsufficientCredits
    ? `Not enough credits: this needs ${creditsLabel(totalCost ?? 0)} and you have ${credits ?? 0}.`
    : undefined

  // Generate → choose a room → confirm → render.
  const openRoomStep = () => {
    if (!canGenerate || isGenerating) return
    setGenerationError('')
    setIsReconfiguring(false)
    setIsRoomStepOpen(true)
    if (!roomLibrary && !isLoadingRooms) void loadRooms()
  }

  // Room confirmed. Two materials on a real room photo go to the placement step first.
  const confirmRoom = (room: RoomSelection | null) => {
    if (!canGenerate || isGenerating) return
    if (room && uploadKind === 'single' && primaryMaterial && accentMaterial) {
      if (!placementRoom || !isSameRoom(placementRoom, room)) setPlacementKey((current) => current + 1)
      setPlacementRoom(room)
      setIsRoomStepOpen(false)
      setIsPlacementOpen(true)
      return
    }
    startGeneration(room, null)
  }

  const confirmPlacement = (areas: PlacementArea[]) => {
    if (!primaryMaterial || !accentMaterial) return
    startGeneration(placementRoom, planPlacement([primaryMaterial, accentMaterial], areas))
  }

  // The last step is confirmed (or a retry): the stage takes over and the render starts at once.
  const startGeneration = (room: RoomSelection | null, plan: PlacementPlan | null) => {
    if (!canGenerate || isGenerating) return
    lastRoom.current = room
    lastPlan.current = plan
    setIsRoomStepOpen(false)
    setIsPlacementOpen(false)
    setIsReconfiguring(false)
    setIsStageRequested(true)
    void generateRender(room, plan)
  }

  // From the result back to its configuration, nothing rendered yet: the placement step with its
  // marked areas as they were when there are two materials on a room photo, otherwise the room step.
  const canReconfigure = uploadKind === 'single' && primaryMaterial !== null
  const reconfigure = () => {
    if (!canReconfigure || isGenerating) return
    const room = lastRoom.current
    setIsStageRequested(false)
    setIsReconfiguring(true)
    if (room && accentMaterial && placementRoom && isSameRoom(placementRoom, room)) {
      setIsPlacementOpen(true)
    } else {
      setIsRoomStepOpen(true)
      if (!roomLibrary && !isLoadingRooms) void loadRooms()
    }
  }

  // Leaves the re-configure steps without rendering; the last result is still there.
  const returnToResult = () => {
    setIsRoomStepOpen(false)
    setIsPlacementOpen(false)
    setIsReconfiguring(false)
    setIsStageRequested(true)
  }

  const generateRender = async (room: RoomSelection | null, plan: PlacementPlan | null) => {
    if (!canGenerate || isGenerating) return
    setIsGenerating(true)
    setGenerationError('')
    setCompletedRenders(0)
    setResultNotice(null)
    let done = 0
    const total = renderCount
    try {
      if (uploadKind === 'multi') {
        // One render per image, in order. Finished images leave the queue, so a retry resumes.
        setBatchProgress({ done: 0, total })
        for (const file of [...pendingFiles]) {
          const material = await fileToMaterial(file)
          const startedAt = Date.now()
          const result = await generateCarpenterRender(account.username, material, null, room)
          done += 1
          setRender(result)
          setRenderName(material.name)
          setRenderSource({ material, sceneName: roomName(room), seconds: Math.round((Date.now() - startedAt) / 1000) })
          setCompletedRenders(done)
          setBatchProgress({ done, total })
          setPendingFiles((current) => current.filter((item) => item !== file))
          await refreshCredits()
        }
      } else if (primaryMaterial) {
        // With a placement plan, its roles apply: the material marked on the photo is the accent.
        const primary = plan?.primary ?? primaryMaterial
        const accent = plan?.accent ?? accentMaterial
        const startedAt = Date.now()
        setRender(await generateCarpenterRender(account.username, primary, accent, room, plan?.accentRegions))
        setRenderName(accent ? `${materialLabel(primaryMaterial)} + ${materialLabel(accentMaterial ?? accent)}` : primary.name)
        setRenderSource({ material: primary, sceneName: roomName(room), seconds: Math.round((Date.now() - startedAt) / 1000) })
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

  /* Result actions */

  const handleDownload = async () => {
    if (!render?.imageUrl || !canDownload || isDownloading) return
    setIsDownloading(true)
    const outcome = await downloadImage(render.imageUrl, renderName)
    setIsDownloading(false)
    setResultNotice(outcome === 'downloaded'
      ? { tone: 'success', message: 'Render downloaded.' }
      : { tone: 'info', message: 'The render opened in a new tab. Save it from there.' })
  }

  const handleSaveToFiles = async () => {
    const imageUrl = render?.imageUrl
    if (!imageUrl || !canSaveToFiles || isSavingToFiles) return
    setIsSavingToFiles(true)
    try {
      await saveRenderToFiles(account.username, {
        imageUrl,
        baseImageUrl: renderSource ? await sourceTextureUrl(renderSource.material) : undefined,
        sceneName: renderSource?.sceneName ?? roomName(null),
        creditsUsed: generationCost,
      })
      setSavedImageUrl(imageUrl)
      setResultNotice({
        tone: 'success',
        message: 'Saved to Files.',
        action: canOpenFiles ? { label: 'Open Files', onClick: onOpenFiles } : undefined,
      })
    } catch (error) {
      setResultNotice({ tone: 'error', message: messageFor(error) })
    } finally {
      setIsSavingToFiles(false)
    }
  }

  const openShare = () => {
    if (!render?.imageUrl || !canShare) return
    setIsShareOpen(true)
    // Refreshed on every open, so a client added by the last share is there to pick.
    setIsLoadingShareClients(true)
    listShareClients(account.username)
      .then(setShareClients)
      .catch(() => undefined)
      .finally(() => setIsLoadingShareClients(false))
  }

  // Shares first (the share sheet only opens straight from the click), then records the attempt.
  const shareRender = async (draft: ShareDraft) => {
    const imageUrl = render?.imageUrl
    if (!imageUrl) return
    try {
      const delivery = await deliverShare({
        text: draft.message || 'Carpenter Pro render',
        url: imageUrl.startsWith('data:') ? undefined : imageUrl,
        allowShareSheet: canUseShareSheet,
        allowCopy: canCopyShare,
      })
      await recordShareAttempt(account.username, {
        clientId: draft.clientId,
        clientName: draft.clientName || undefined,
        whatsapp: draft.whatsapp || undefined,
        followUpDate: draft.followUpDate || undefined,
        generationId: render?.generationId,
        outgoingMessage: draft.message || undefined,
        ...delivery,
      })
      setIsShareOpen(false)
      setResultNotice({
        tone: delivery.status === 'cancelled' ? 'info' : 'success',
        message: delivery.status === 'cancelled'
          ? 'Share cancelled. It was recorded as a cancelled attempt.'
          : `${delivery.channel === 'copy' ? 'Message copied. ' : ''}Share attempt recorded for ${draft.clientName}.`,
      })
      // The overview counts share attempts and follow-ups.
      void getShareStats(account.username).then(setShareStats).catch(() => undefined)
    } catch (error) {
      // The dialog shows the message and stays open.
      throw error instanceof Error ? error : new Error(messageFor(error))
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
      className={`carpenter-dashboard app-enter-fade ${isOverviewOpen ? 'is-overview-open' : ''} ${isRoomStepOpen || isPlacementOpen ? 'is-room-step' : ''} ${isPlacementOpen ? 'is-placement-step' : ''}`}
      hidden={hidden}
      onPointerMove={updateOverviewAtmosphere}
      onPointerLeave={resetOverviewAtmosphere}
    >
      <AnimatedGridPattern className="dashboard-grid" width={44} height={44} numSquares={24} duration={4} />
      <div className="dashboard-content" inert={isOverviewOpen}>
        <section className="workspace-intro app-enter-fade" aria-labelledby="workspace-title" hidden={isStageOpen}>
          <h1 id="workspace-title">Bring your laminates to life.</h1>
          <p>Turn a material into a space your clients can imagine.</p>
        </section>

        {/* Hidden, not unmounted, while the generation stage is showing: the upload and room stay as they were. */}
        <section className="workspace-composer app-enter-fade" aria-label="Common workspace" hidden={isStageOpen}>
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
          <div ref={uploadStep} className="composer-step app-enter" hidden={isRoomStepOpen || isPlacementOpen} tabIndex={-1}>
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
                  ? uploadKind === 'single' ? `${accentMaterial ? '2 materials selected · one render' : '1 image selected'} · click or drop to replace`
                    : uploadKind === 'multi' ? `${pendingFiles.length} images selected · one render each · click or drop to replace`
                      : uploadKind === 'reel' ? 'Video selected · click or drop to replace'
                        : 'Click or drop here: one image, several images, or a video'
                  : canBrowseLibrary ? 'Browse the laminate collections shared with you' : 'Contact your organization administrator for access.'}</small>
              </span>
            </button>

            {(primaryMaterial || accentMaterial) ? (
              <div className="selected-materials" aria-live="polite">
                {primaryMaterial ? (
                  <MaterialPill label={accentMaterial ? 'First' : 'Primary'} material={primaryMaterial} onRemove={() => removeMaterial('primary')} />
                ) : null}
                {accentMaterial ? (
                  <MaterialPill label="Second" material={accentMaterial} onRemove={() => removeMaterial('accent')} />
                ) : null}
                {primaryMaterial && accentMaterial ? (
                  <p className="selected-materials-note">
                    Both go into one render; you mark where each goes after choosing the room.
                    {pairFiles ? (
                      <>
                        {' '}
                        <Button variant="link" size="xs" className="dashboard-message-action" disabled={isGenerating} onClick={separatePair}>
                          Render them separately instead
                        </Button>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
            ) : null}

            {pendingFiles.length ? (
              <div className="pending-files-summary app-enter" role="status">
                <span className="pending-files-copy">
                  <strong>{pendingFiles.length} {uploadKind === 'reel' ? 'video' : 'product image'}{pendingFiles.length === 1 ? '' : 's'} selected{uploadKind === 'multi' ? ' · one render each' : ''}</strong>
                  <small>{pendingFiles.slice(0, 2).map((file) => file.name).join(', ')}{pendingFiles.length > 2 ? ` +${pendingFiles.length - 2} more` : ''}</small>
                </span>
                <span className="pending-files-actions">
                  {uploadKind === 'multi' && pendingFiles.length === 2 ? (
                    <Button variant="link" size="xs" disabled={isGenerating} onClick={() => void combinePair(pendingFiles)}>Use both in one render</Button>
                  ) : null}
                  <Button variant="link" size="xs" disabled={isGenerating} onClick={() => setPendingFiles([])}>Clear</Button>
                </span>
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
                  : 'Creating your render. This can take a few minutes.'}{' '}
                <Button variant="link" size="xs" className="dashboard-message-action" onClick={() => setIsStageRequested(true)}>
                  View progress
                </Button>
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
            blockedReason={generateBlockedReason}
            onSkip={() => confirmRoom(null)}
            onBack={isReconfiguring ? returnToResult : () => setIsRoomStepOpen(false)}
            backLabel={isReconfiguring ? 'Back to result' : undefined}
          />

          {/* Step 3, for two materials: mark where each goes on the room photo. */}
          {placementRoom && primaryMaterial && accentMaterial ? (
            <MaterialPlacement
              key={placementKey}
              ref={placementStep}
              hidden={!isPlacementOpen}
              roomImageUrl={roomImageUrl(placementRoom)}
              materials={[primaryMaterial, accentMaterial]}
              confirmLabel={totalCost !== null ? `Generate · ${creditsLabel(totalCost)}` : 'Generate'}
              onConfirm={confirmPlacement}
              blockedReason={generateBlockedReason}
              onSkip={() => startGeneration(placementRoom, null)}
              onBack={isReconfiguring ? returnToResult : () => {
                setIsPlacementOpen(false)
                setIsRoomStepOpen(true)
              }}
              backLabel={isReconfiguring ? 'Back to result' : undefined}
            />
          ) : null}
        </section>

        {/* Last step: generating, then the result or the error, in place of the studio content. */}
        {isStageOpen && stageView ? (
          <GenerationStage
            ref={stage}
            view={stageView}
            batchProgress={batchProgress}
            render={render}
            renderName={renderName}
            sceneName={renderSource?.sceneName}
            renderSeconds={renderSource?.seconds}
            completedRenders={completedRenders}
            error={generationError}
            canRetry={canGenerate}
            onRetry={() => startGeneration(lastRoom.current, lastPlan.current)}
            onBack={() => setIsStageRequested(false)}
            onDownload={canDownload ? () => void handleDownload() : undefined}
            isDownloading={isDownloading}
            onShare={canShare ? openShare : undefined}
            onSaveToFiles={canSaveToFiles ? () => void handleSaveToFiles() : undefined}
            saveStatus={isSavingToFiles ? 'saving' : savedImageUrl !== null && savedImageUrl === render?.imageUrl ? 'saved' : 'idle'}
            onReconfigure={canReconfigure ? reconfigure : undefined}
            notice={resultNotice}
            onDismissNotice={() => setResultNotice(null)}
          />
        ) : null}

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

      {/* Kept mounted so it closes with the dialog's exit animation; keyed so each render starts a fresh form. */}
      {canShare ? (
        <ShareDialog
          key={render?.generationId ?? render?.imageUrl ?? 'none'}
          open={isShareOpen && isStageOpen && stageView === 'result'}
          onClose={() => setIsShareOpen(false)}
          clients={shareClients}
          isLoadingClients={isLoadingShareClients}
          defaultMessage={account.shareMessagePreset}
          mode={canUseShareSheet && hasShareSheet() ? 'share' : 'copy'}
          onShare={shareRender}
        />
      ) : null}

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