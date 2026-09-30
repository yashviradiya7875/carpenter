import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { ApiError, callApi, callApiMultipart } from '../../shared/api/client'
import type { AuthAccount } from '../../shared/auth/types'
import { Brand, Mark } from './components/DashboardIcon'
import { LibraryDialog } from './components/LibraryDialog'
import { UploadOptionsDialog } from './components/UploadOptionsDialog'
import { UPLOAD_TYPES, type Collection, type MaterialChoice, type MaterialSlot, type Product, type ProductDetails, type UploadType } from './dashboardTypes'
import './DashboardPage.css'

type ShareStats = {
  total?: number
  uniqueClients?: number
  followUps?: { overdue?: number; dueToday?: number; upcoming?: number }
}
type GenerationResult = { imageUrl?: string; generationId?: string }
type DashboardPageProps = { account: AuthAccount; onSignOut: () => void }
const MAX_RENDER_MATERIAL_BYTES = 20 * 1024 * 1024
const MAX_MULTI_PRODUCT_FILES = 200

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
  const libraryImageInput = useRef<HTMLInputElement>(null)
  const libraryFolderInput = useRef<HTMLInputElement>(null)

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
      const formData = new FormData()
      uniqueFiles.forEach((file) => formData.append('files', file))
      formData.append('collectionId', collectionId)
      formData.append('type', 'laminate')
      formData.append('autoPublish', '1')
      formData.append('paths', JSON.stringify(uniqueFiles.map((file) => {
        const fileWithPath = file as File & { webkitRelativePath?: string }
        return fileWithPath.webkitRelativePath || file.name
      })))
      formData.append('username', account.username)

      const result = await callApiMultipart<{ success?: boolean; collection?: Collection; productsCreated?: number; products?: Product[] }>(
        'uploadProducts',
        formData,
      )

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
      const collection = await callApi<Collection, {
        username: string; name: string; type: string; description: string; isShared: boolean
      }>('createCollection', {
        username: account.username,
        name: trimmed,
        type: 'laminate',
        description: 'Created from Carpenter Pro library',
        isShared: false,
      })

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
      const result = await callApi<{ collections: Collection[] }, {
        username: string; type: string; page: number; pageSize: number; search: string
      }>('listCollections', {
        username: account.username,
        type: 'laminate',
        page: 1,
        pageSize: 40,
        search: searchOverride,
      })
      const nextCollections = result.collections ?? []
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
      const result = await callApi<{ products: Product[] }, {
        username: string; collectionId: string; type: string; page: number; pageSize: number; search: string
      }>('listProducts', {
        username: account.username,
        collectionId: collection.id,
        type: 'laminate',
        page: 1,
        pageSize: 40,
        search: searchOverride,
      })
      const resultProducts = result.products ?? []
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
      const result = await callApi<{ success: boolean }, { username: string; productId: string }>(
        'deleteProduct',
        { username: account.username, productId: product.id },
      )
      if (!result.success) throw new ApiError('The product could not be deleted.')

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
      const result = await callApi<{ success: boolean }, { username: string; collectionId: string }>(
        'deleteCollection',
        { username: account.username, collectionId: collection.id },
      )
      if (!result.success) throw new ApiError('The collection could not be deleted.')

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
        <UploadOptionsDialog
          selectedUploadType={selectedUploadType}
          dialogRef={uploadDialog}
          onClose={closeUploadOptions}
          onSelect={selectUploadType}
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