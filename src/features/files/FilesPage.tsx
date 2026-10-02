import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react'
import { toast, ToastContainer } from 'react-toastify'
import type { AuthAccount } from '../../shared/auth/types'
import { Brand, Mark } from '../dashboard/components/DashboardIcon'
import {
  createDriveFolder,
  createDriveShareLink,
  deleteDriveFolder,
  getDriveActivity,
  getDriveResourceShares,
  getSharedDriveResource,
  getString,
  isRecord,
  listDriveContents,
  loadDriveFolderTree,
  moveDriveFile,
  moveDriveFolder,
  renameDriveResource,
  revokeDriveShareLink,
  shareDriveResource,
  toggleDriveFavorite,
  uploadDriveImage,
  type DriveFile,
  type DriveFolder,
  type DriveResourceType,
  type DriveRole,
} from './filesService'
import 'react-toastify/dist/ReactToastify.css'
import './FilesPage.css'

type FilesPageProps = {
  account: AuthAccount
  onBack: () => void
  onSignOut: () => void
}

type ShareTarget = {
  id: string
  name: string
  resourceType: DriveResourceType
  myRole?: string
}

type MoveTarget = {
  id: string
  name: string
  resourceType: DriveResourceType
  currentParentId: string | null
}

type ShareDraft = {
  visibility: 'private' | 'organization' | 'public'
  permissions: Record<string, DriveRole>
}

type FilesViewMode = 'large' | 'small' | 'list'

const DRIVE_ROLES: DriveRole[] = ['owner', 'admin', 'editor', 'viewer']

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

function canEdit(role?: string): boolean {
  return role === 'owner' || role === 'admin' || role === 'editor'
}

function canManage(role?: string): boolean {
  return role === 'owner' || role === 'admin'
}

function asShareDraft(value: unknown): ShareDraft {
  const record = isRecord(value) ? value : {}
  const rawPermissions = isRecord(record.permissions) ? record.permissions : {}
  const permissions: Record<string, DriveRole> = {}

  Object.entries(rawPermissions).forEach(([username, role]) => {
    if (typeof role === 'string' && DRIVE_ROLES.includes(role as DriveRole)) permissions[username] = role as DriveRole
  })

  if (Array.isArray(record.sharedWith)) {
    record.sharedWith.forEach((username) => {
      if (typeof username === 'string' && !permissions[username]) permissions[username] = 'viewer'
    })
  }

  if (Array.isArray(record.shares)) {
    record.shares.forEach((share) => {
      const username = getString(share, 'username', 'userName')
      const role = getString(share, 'role', 'permission')
      if (username && role && DRIVE_ROLES.includes(role as DriveRole)) permissions[username] = role as DriveRole
    })
  }

  const visibility = record.visibility === 'organization' || record.visibility === 'public'
    ? record.visibility
    : 'private'

  return { visibility, permissions }
}

function shareLinkToken(value: unknown): string | null {
  if (!isRecord(value)) return null
  const directToken = getString(value, 'token', 'shareToken')
  if (directToken) return directToken
  if (Array.isArray(value.links)) {
    for (const link of value.links) {
      const token = getString(link, 'token', 'shareToken')
      if (token) return token
    }
  }
  const nested = isRecord(value.shareLink) ? value.shareLink : isRecord(value.link) ? value.link : null
  return nested ? getString(nested, 'token', 'shareToken') ?? null : null
}

function formatDate(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(avif|bmp|gif|jpe?g|png|tiff?|webp)$/i.test(file.name)
}

function isDescendant(folderId: string, candidate: DriveFolder, folders: DriveFolder[]): boolean {
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]))
  let parentId = candidate.parentId
  while (parentId) {
    if (parentId === folderId) return true
    parentId = foldersById.get(parentId)?.parentId ?? null
  }
  return false
}

export function FilesPage({ account, onBack, onSignOut }: FilesPageProps) {
  const [folderPath, setFolderPath] = useState<DriveFolder[]>([])
  const [folders, setFolders] = useState<DriveFolder[]>([])
  const [folderTree, setFolderTree] = useState<DriveFolder[]>([])
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => new Set())
  const [files, setFiles] = useState<DriveFile[]>([])
  const [viewMode, setViewMode] = useState<FilesViewMode>('list')
  const [search, setSearch] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingTree, setIsLoadingTree] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null)
  const [moveFolders, setMoveFolders] = useState<DriveFolder[]>([])
  const [moveDestination, setMoveDestination] = useState('')
  const [isLoadingMoveFolders, setIsLoadingMoveFolders] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DriveFolder | null>(null)
  const [deleteFiles, setDeleteFiles] = useState(false)
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null)
  const [shareDraft, setShareDraft] = useState<ShareDraft>({ visibility: 'private', permissions: {} })
  const [shareUsername, setShareUsername] = useState('')
  const [shareRole, setShareRole] = useState<DriveRole>('viewer')
  const [shareLinkTokenValue, setShareLinkTokenValue] = useState<string | null>(null)
  const [shareLinkRole, setShareLinkRole] = useState<DriveRole>('viewer')
  const [isLoadingShares, setIsLoadingShares] = useState(false)
  const [isSavingShares, setIsSavingShares] = useState(false)
  const [isCreatingLink, setIsCreatingLink] = useState(false)
  const [isRevokingLink, setIsRevokingLink] = useState(false)
  const [isActivityOpen, setIsActivityOpen] = useState(false)
  const [activity, setActivity] = useState<unknown[]>([])
  const [isLoadingActivity, setIsLoadingActivity] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ completed: 0, total: 0 })
  const uploadInput = useRef<HTMLInputElement>(null)

  const currentFolder = folderPath.at(-1) ?? null
  const currentFolderId = currentFolder?.id ?? null
  const hasFilesAccess = account.capabilities?.filesAccess !== undefined
    && account.capabilities.filesAccess !== 'none'
  const hasFullFilesAccess = account.capabilities?.filesAccess === 'full'
  const canCreateHere = hasFullFilesAccess && (!currentFolder || canEdit(currentFolder.myRole))
  const canUploadHere = canCreateHere && account.capabilities?.canSaveToFiles === true

  useEffect(() => {
    if (!hasFilesAccess) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setIsLoading(true)
      listDriveContents(account.username, currentFolderId, search.trim(), favoritesOnly, { signal: controller.signal })
        .then((contents) => {
          setFolders(contents.folders)
          setFiles(contents.files)
        })
        .catch((requestError: unknown) => {
          if (!controller.signal.aborted) toast.error(errorMessage(requestError))
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false)
        })
    }, search ? 220 : 0)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [account.username, currentFolderId, favoritesOnly, hasFilesAccess, reloadKey, search])

  useEffect(() => {
    if (!hasFilesAccess) return
    const controller = new AbortController()
    loadDriveFolderTree(account.username, { signal: controller.signal })
      .then(setFolderTree)
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) toast.error(errorMessage(requestError))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingTree(false)
      })
    return () => controller.abort()
  }, [account.username, hasFilesAccess, reloadKey])

  const refresh = () => setReloadKey((value) => value + 1)

  const openFolder = (folder: DriveFolder) => {
    setFolderPath((current) => {
      const existingIndex = current.findIndex((item) => item.id === folder.id)
      if (existingIndex >= 0) return current.slice(0, existingIndex + 1)
      if (folder.parentId === (current.at(-1)?.id ?? null)) return [...current, folder]
      return [folder]
    })
    setSearch('')
    setFavoritesOnly(false)
  }

  const navigateToFolder = (folderId: string | null) => {
    if (!folderId) {
      setFolderPath([])
    } else {
      const foldersById = new Map(folderTree.map((folder) => [folder.id, folder]))
      const nextPath: DriveFolder[] = []
      let folder = foldersById.get(folderId)
      while (folder) {
        nextPath.unshift(folder)
        folder = folder.parentId ? foldersById.get(folder.parentId) : undefined
      }
      setFolderPath(nextPath)
    }
    setSearch('')
    setFavoritesOnly(false)
  }

  const navigateToFolderFromTree = (folderId: string) => {
    const foldersById = new Map(folderTree.map((folder) => [folder.id, folder]))
    const ancestors: string[] = []
    let folder = foldersById.get(folderId)
    while (folder?.parentId) {
      ancestors.push(folder.parentId)
      folder = foldersById.get(folder.parentId)
    }
    setExpandedFolderIds((current) => new Set([...current, ...ancestors]))
    navigateToFolder(folderId)
  }

  const toggleFolderTreeNode = (folderId: string) => {
    setExpandedFolderIds((current) => {
      const next = new Set(current)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const uploadImages = async (incomingFiles: File[]) => {
    const images = incomingFiles.filter(isImageFile)
    if (!images.length) {
      toast.warning('Choose image files to upload.')
      return
    }
    if (!canUploadHere) {
      toast.warning('You need editor access and save-to-Files permission to upload images here.')
      return
    }
    const skippedCount = incomingFiles.length - images.length
    if (skippedCount) toast.warning(`${skippedCount} non-image file${skippedCount === 1 ? ' was' : 's were'} skipped.`)

    setIsUploading(true)
    setUploadProgress({ completed: 0, total: images.length })
    setSearch('')
    setFavoritesOnly(false)
    let uploaded = 0
    const failedFiles: string[] = []

    for (const file of images) {
      try {
        await uploadDriveImage(account.username, file, currentFolderId)
        uploaded += 1
      } catch (uploadError) {
        failedFiles.push(`${file.name}: ${errorMessage(uploadError)}`)
      }
      setUploadProgress({ completed: uploaded + failedFiles.length, total: images.length })
    }

    if (uploaded || failedFiles.length) refresh()
    if (uploaded) {
      toast.success(`${uploaded} image${uploaded === 1 ? '' : 's'} uploaded to ${currentFolder?.name ?? 'Home'}.`)
    }
    if (failedFiles.length) {
      const message = failedFiles.length === 1 ? failedFiles[0] : `${failedFiles.length} images could not be uploaded.`
      if (uploaded) toast.warning(message)
      else toast.error(message)
    }
    setIsUploading(false)
  }

  const handleUploadSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    void uploadImages(selectedFiles)
  }

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    if (canUploadHere) setIsDragActive(true)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = canUploadHere ? 'copy' : 'none'
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) setIsDragActive(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.files.length) return
    event.preventDefault()
    setIsDragActive(false)
    void uploadImages(Array.from(event.dataTransfer.files))
  }

  const runMutation = async (id: string, action: () => Promise<unknown>, successMessage: string) => {
    setBusyId(id)
    try {
      await action()
      toast.success(successMessage)
      refresh()
    } catch (requestError) {
      toast.error(errorMessage(requestError))
    } finally {
      setBusyId(null)
    }
  }

  const createFolder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = folderName.trim()
    if (!name) return
    setIsCreatingFolder(true)
    try {
      await createDriveFolder(account.username, name, currentFolderId)
      setFolderName('')
      setIsCreateFolderOpen(false)
      toast.success(`Folder “${name}” created.`)
      refresh()
    } catch (requestError) {
      toast.error(errorMessage(requestError))
    } finally {
      setIsCreatingFolder(false)
    }
  }

  const renameResource = async (resource: DriveFolder | DriveFile, resourceType: DriveResourceType) => {
    const newName = window.prompt(`Rename ${resourceType}`, resource.name)?.trim()
    if (!newName || newName === resource.name) return
    await runMutation(resource.id, async () => {
      const result = await renameDriveResource(account.username, resource.id, resourceType, newName)
      if (!result.success) throw new Error('The resource could not be renamed.')
    }, `${resourceType === 'folder' ? 'Folder' : 'File'} renamed.`)
  }

  const toggleFavorite = async (resource: DriveFolder | DriveFile, resourceType: DriveResourceType) => {
    await runMutation(resource.id, async () => {
      const result = await toggleDriveFavorite(account.username, resource.id, resourceType)
      if (!result.success) throw new Error('The favorite could not be updated.')
    }, resource.isFavorite ? 'Removed from favorites.' : 'Added to favorites.')
  }

  const openMoveDialog = async (resource: DriveFolder | DriveFile, resourceType: DriveResourceType) => {
    setIsLoadingMoveFolders(true)
    setMoveDestination(resource.parentId ?? '')
    setMoveTarget({ id: resource.id, name: resource.name, resourceType, currentParentId: resource.parentId })
    try {
      setMoveFolders(await loadDriveFolderTree(account.username))
    } catch (requestError) {
      toast.error(errorMessage(requestError))
      setMoveTarget(null)
    } finally {
      setIsLoadingMoveFolders(false)
    }
  }

  const moveResource = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!moveTarget) return
    const destination = moveDestination || null
    if (destination === moveTarget.currentParentId) {
      setMoveTarget(null)
      return
    }

    await runMutation(moveTarget.id, async () => {
      const result = moveTarget.resourceType === 'folder'
        ? await moveDriveFolder(account.username, moveTarget.id, destination)
        : await moveDriveFile(account.username, moveTarget.id, destination)
      if (!result.success) throw new Error('The item could not be moved.')
    }, `${moveTarget.resourceType === 'folder' ? 'Folder' : 'File'} moved.`)
    setMoveTarget(null)
  }

  const confirmDeleteFolder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!deleteTarget) return
    await runMutation(deleteTarget.id, async () => {
      const result = await deleteDriveFolder(account.username, deleteTarget.id, deleteFiles)
      if (!result.success) throw new Error('The folder could not be deleted.')
    }, `${deleteTarget.name} deleted.`)

    const deletedIndex = folderPath.findIndex((folder) => folder.id === deleteTarget.id)
    if (deletedIndex >= 0) setFolderPath((current) => current.slice(0, deletedIndex))
    setDeleteTarget(null)
    setDeleteFiles(false)
  }

  const openShareDialog = async (target: ShareTarget) => {
    setShareTarget(target)
    setShareDraft({ visibility: 'private', permissions: {} })
    setShareLinkTokenValue(null)
    setShareUsername('')
    setIsLoadingShares(true)
    try {
      const result = await getDriveResourceShares(account.username, target.id, target.resourceType)
      setShareDraft(asShareDraft(result))
      setShareLinkTokenValue(shareLinkToken(result))
    } catch (requestError) {
      toast.error(errorMessage(requestError))
    } finally {
      setIsLoadingShares(false)
    }
  }

  const saveShares = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!shareTarget) return
    setIsSavingShares(true)
    try {
      const result = await shareDriveResource(account.username, shareTarget.id, shareTarget.resourceType, {
        visibility: shareDraft.visibility,
        permissions: shareDraft.permissions,
        sharedWith: Object.entries(shareDraft.permissions)
          .filter(([, role]) => role === 'viewer')
          .map(([username]) => username),
      })
      if (!result.success) throw new Error('Sharing settings could not be saved.')
      toast.success('Sharing settings saved.')
      setShareTarget(null)
    } catch (requestError) {
      toast.error(errorMessage(requestError))
    } finally {
      setIsSavingShares(false)
    }
  }

  const addSharePermission = () => {
    const username = shareUsername.trim()
    if (!username) return
    setShareDraft((current) => ({
      ...current,
      permissions: { ...current.permissions, [username]: shareRole },
    }))
    setShareUsername('')
  }

  const createShareLink = async () => {
    if (!shareTarget) return
    setIsCreatingLink(true)
    try {
      const result = await createDriveShareLink(account.username, shareTarget.id, shareTarget.resourceType, shareLinkRole)
      setShareLinkTokenValue(result.token)
      toast.success('Share link created.')
    } catch (requestError) {
      toast.error(errorMessage(requestError))
    } finally {
      setIsCreatingLink(false)
    }
  }

  const copyShareLink = async () => {
    if (!shareLinkTokenValue) return
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/share/${encodeURIComponent(shareLinkTokenValue)}`)
      toast.info('Share link copied.')
    } catch {
      toast.error('Unable to copy the share link in this browser.')
    }
  }

  const revokeShareLink = async () => {
    if (!shareLinkTokenValue) return
    setIsRevokingLink(true)
    try {
      const result = await revokeDriveShareLink(account.username, shareLinkTokenValue)
      if (!result.success) throw new Error('The share link could not be revoked.')
      setShareLinkTokenValue(null)
      toast.success('Share link revoked.')
    } catch (requestError) {
      toast.error(errorMessage(requestError))
    } finally {
      setIsRevokingLink(false)
    }
  }

  const toggleActivity = async () => {
    if (isActivityOpen) {
      setIsActivityOpen(false)
      return
    }
    setIsActivityOpen(true)
    setIsLoadingActivity(true)
    try {
      const result = await getDriveActivity(account.username, currentFolderId)
      setActivity(Array.isArray(result.activity) ? result.activity : [])
    } catch (requestError) {
      toast.error(errorMessage(requestError))
    } finally {
      setIsLoadingActivity(false)
    }
  }

  const destinationFolders = moveTarget?.resourceType === 'folder'
    ? moveFolders.filter((folder) => folder.id !== moveTarget.id && !isDescendant(moveTarget.id, folder, moveFolders))
    : moveFolders

  if (!hasFilesAccess) {
    return (
      <main className="files-page">
        <FilesTopbar onBack={onBack} onSignOut={onSignOut} />
        <section className="files-access-message">
          <Mark name="folder" />
          <h1>Files access unavailable</h1>
          <p>This account does not have permission to open Files.</p>
          <button className="files-button primary" type="button" onClick={onBack}>Back to studio</button>
        </section>
      </main>
    )
  }

  return (
    <main className="files-page">
      <FilesTopbar onBack={onBack} onSignOut={onSignOut} />
      <ToastContainer position="bottom-right" autoClose={3500} newestOnTop closeOnClick pauseOnHover theme="dark" limit={4} />
      <div
        className={`files-content ${isDragActive ? 'is-drag-active' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input ref={uploadInput} className="files-upload-input" type="file" accept="image/*" multiple onChange={handleUploadSelection} tabIndex={-1} />
        {isDragActive ? <div className="files-drop-overlay" aria-hidden="true"><Mark name="upload" /><strong>Drop images to upload</strong><span>Images will be added to {currentFolder?.name ?? 'Home'}</span></div> : null}
        <header className="files-heading">
          <div>
            <span className="files-kicker">CARPENTER PRO</span>
            <h1>Files</h1>
            <p>Your saved renders and folders.</p>
          </div>
          <button className="files-button subtle" type="button" onClick={() => void toggleActivity()} aria-expanded={isActivityOpen}>
            <Mark name="activity" /> Activity
          </button>
        </header>

        <nav className="files-breadcrumbs" aria-label="Folder path">
          <button type="button" onClick={() => setFolderPath([])} aria-current={folderPath.length === 0 ? 'page' : undefined}>
            <Mark name="home" /> Home
          </button>
          {folderPath.map((folder, index) => (
            <span className="files-breadcrumb-item" key={folder.id}>
              <Mark name="arrow" />
              <button type="button" onClick={() => setFolderPath((current) => current.slice(0, index + 1))} aria-current={index === folderPath.length - 1 ? 'page' : undefined}>
                {folder.name}
              </button>
            </span>
          ))}
        </nav>

        <div className="files-toolbar">
          <label className="files-search">
            <Mark name="search" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search files and folders" aria-label="Search files and folders" />
          </label>
          <div className="files-view-switch" role="group" aria-label="Folder contents view">
            <button className={viewMode === 'large' ? 'is-active' : ''} type="button" aria-label="Large icon view" aria-pressed={viewMode === 'large'} title="Large icons" onClick={() => setViewMode('large')}>
              <Mark name="gridLarge" /><span>Large</span>
            </button>
            <button className={viewMode === 'small' ? 'is-active' : ''} type="button" aria-label="Small icon view" aria-pressed={viewMode === 'small'} title="Small icons" onClick={() => setViewMode('small')}>
              <Mark name="gridSmall" /><span>Small</span>
            </button>
            <button className={viewMode === 'list' ? 'is-active' : ''} type="button" aria-label="List view" aria-pressed={viewMode === 'list'} title="List" onClick={() => setViewMode('list')}>
              <Mark name="listView" /><span>List</span>
            </button>
          </div>
          <div className="files-toolbar-actions">
            <button className={`files-button subtle ${favoritesOnly ? 'is-active' : ''}`} type="button" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly((value) => !value)}>
              <Mark name="star" /> Favorites
            </button>
            <button className="files-button subtle files-refresh" type="button" onClick={refresh} aria-label="Refresh files">
              <Mark name="refresh" />
            </button>
            {account.capabilities?.canSaveToFiles ? (
              <button className="files-button subtle" type="button" onClick={() => uploadInput.current?.click()} disabled={!canUploadHere || isUploading} title={!canUploadHere ? 'You need editor access to upload into this folder.' : undefined}>
                <Mark name="upload" /> {isUploading ? `Uploading ${uploadProgress.completed}/${uploadProgress.total}` : 'Upload images'}
              </button>
            ) : null}
            <button className="files-button primary" type="button" onClick={() => { setFolderName(''); setIsCreateFolderOpen(true) }} disabled={!canCreateHere} title={!canCreateHere ? 'You need editor access to create a folder here.' : undefined}>
              <Mark name="plus" /> New folder
            </button>
          </div>
        </div>

        <div className={`files-layout ${isActivityOpen ? 'with-activity' : ''}`}>
          <DriveFolderTree
            folders={folderTree}
            currentFolderId={currentFolderId}
            activePath={folderPath.map((folder) => folder.id)}
            expandedFolderIds={expandedFolderIds}
            isLoading={isLoadingTree}
            onNavigate={navigateToFolderFromTree}
            onNavigateHome={() => navigateToFolder(null)}
            onToggle={toggleFolderTreeNode}
          />
          <section className={`files-browser view-${viewMode}`} aria-label="Files and folders">
            <div className="files-list-heading">
              <span>Name</span><span>Updated</span><span>Access</span><span className="sr-only">Actions</span>
            </div>
            {isLoading ? (
              <div className="files-state" role="status"><span className="loading-indicator" /> Loading files…</div>
            ) : folders.length || files.length ? (
              <div className="files-list">
                {folders.map((folder) => (
                  <FileRow
                    key={`folder-${folder.id}`}
                    name={folder.name}
                    kind="folder"
                    updatedAt={folder.updatedAt}
                    role={hasFullFilesAccess ? folder.myRole : 'viewer'}
                    isFavorite={folder.isFavorite}
                    isBusy={busyId === folder.id}
                    onOpen={() => openFolder(folder)}
                    onFavorite={() => void toggleFavorite(folder, 'folder')}
                    onRename={() => void renameResource(folder, 'folder')}
                    onMove={() => void openMoveDialog(folder, 'folder')}
                    onShare={() => void openShareDialog({ id: folder.id, name: folder.name, resourceType: 'folder', myRole: folder.myRole })}
                    onDelete={() => { setDeleteTarget(folder); setDeleteFiles(false) }}
                    canManage={hasFullFilesAccess && canManage(folder.myRole)}
                  />
                ))}
                {files.map((file) => (
                  <FileRow
                    key={`file-${file.id}`}
                    name={file.name}
                    kind="file"
                    updatedAt={file.updatedAt ?? file.createdAt}
                    role={hasFullFilesAccess ? file.myRole : 'viewer'}
                    isFavorite={file.isFavorite}
                    imageUrl={file.imageUrl}
                    detail={file.tool}
                    isBusy={busyId === file.id}
                    onOpen={() => file.imageUrl && window.open(file.imageUrl, '_blank', 'noopener,noreferrer')}
                    onFavorite={() => void toggleFavorite(file, 'file')}
                    onRename={() => void renameResource(file, 'file')}
                    onMove={() => void openMoveDialog(file, 'file')}
                    onShare={() => void openShareDialog({ id: file.id, name: file.name, resourceType: 'file', myRole: file.myRole })}
                    canManage={hasFullFilesAccess && canManage(file.myRole)}
                  />
                ))}
                {canUploadHere && !search && !favoritesOnly ? <UploadImagesRow onClick={() => uploadInput.current?.click()} isUploading={isUploading} /> : null}
              </div>
            ) : (
              <div className="files-state empty-state">
                <Mark name={search || favoritesOnly ? 'search' : 'folder'} />
                <h2>{search ? 'No matching items' : favoritesOnly ? 'No favorites yet' : 'This folder is empty'}</h2>
                <p>{search ? 'Try another search.' : favoritesOnly ? 'Favorite a file or folder to find it here.' : canUploadHere ? 'Upload images or generate a render to see it here.' : 'Create a folder or generate a render to see it here.'}</p>
                {!search && !favoritesOnly && canCreateHere ? (
                  <div className="files-empty-actions">
                    {canUploadHere ? <button className="files-button subtle" type="button" onClick={() => uploadInput.current?.click()} disabled={isUploading}><Mark name="upload" /> Upload images</button> : null}
                    <button className="files-button primary" type="button" onClick={() => setIsCreateFolderOpen(true)}><Mark name="plus" /> New folder</button>
                  </div>
                ) : null}
              </div>
            )}
          </section>

          {isActivityOpen ? (
            <aside className="files-activity-panel" aria-label="Recent activity">
              <header><h2>Activity</h2><button className="files-icon-button" type="button" onClick={() => setIsActivityOpen(false)} aria-label="Close activity"><Mark name="close" /></button></header>
              {isLoadingActivity ? <div className="files-state compact" role="status"><span className="loading-indicator" /> Loading activity…</div> : activity.length ? (
                <ul>
                  {activity.map((item, index) => (
                    <li key={getString(item, 'id', 'activityId') ?? `activity-${index}`}>
                      <strong>{getString(item, 'action', 'event', 'kind', 'type') ?? 'File activity'}</strong>
                      <span>{getString(item, 'resourceName', 'name', 'message') ?? 'A resource was updated'}</span>
                      <time>{formatDate(getString(item, 'createdAt', 'timestamp'))}</time>
                    </li>
                  ))}
                </ul>
              ) : <p className="files-activity-empty">No activity to show.</p>}
            </aside>
          ) : null}
        </div>
      </div>

      {isCreateFolderOpen ? (
        <div className="files-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsCreateFolderOpen(false) }}>
          <form className="files-modal" role="dialog" aria-modal="true" aria-labelledby="create-folder-title" onSubmit={(event) => void createFolder(event)}>
            <span className="files-modal-icon"><Mark name="folder" /></span>
            <h2 id="create-folder-title">New folder</h2>
            <p>Create a folder in {currentFolder?.name ?? 'Home'}.</p>
            <label className="files-field"><span>Folder name</span><input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} maxLength={120} required /></label>
            <div className="files-modal-actions">
              <button className="files-button subtle" type="button" disabled={isCreatingFolder} onClick={() => setIsCreateFolderOpen(false)}>Cancel</button>
              <button className="files-button primary" type="submit" disabled={isCreatingFolder || !folderName.trim()}>{isCreatingFolder ? 'Creating…' : 'Create folder'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {moveTarget ? (
        <div className="files-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isLoadingMoveFolders) setMoveTarget(null) }}>
          <form className="files-modal" role="dialog" aria-modal="true" aria-labelledby="move-resource-title" onSubmit={(event) => void moveResource(event)}>
            <span className="files-modal-icon"><Mark name="folder" /></span>
            <h2 id="move-resource-title">Move {moveTarget.resourceType}</h2>
            <p>Choose a destination for <strong>{moveTarget.name}</strong>.</p>
            {isLoadingMoveFolders ? <div className="files-state compact" role="status"><span className="loading-indicator" /> Loading folders…</div> : (
              <label className="files-field"><span>Destination</span>
                <select autoFocus value={moveDestination} onChange={(event) => setMoveDestination(event.target.value)}>
                  <option value="">Home</option>
                  {destinationFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                </select>
              </label>
            )}
            <div className="files-modal-actions">
              <button className="files-button subtle" type="button" disabled={busyId === moveTarget.id} onClick={() => setMoveTarget(null)}>Cancel</button>
              <button className="files-button primary" type="submit" disabled={isLoadingMoveFolders || busyId === moveTarget.id}>{busyId === moveTarget.id ? 'Moving…' : 'Move'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="files-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && busyId !== deleteTarget.id) setDeleteTarget(null) }}>
          <form className="files-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-folder-title" onSubmit={(event) => void confirmDeleteFolder(event)}>
            <span className="files-modal-icon danger"><Mark name="trash" /></span>
            <h2 id="delete-folder-title">Delete {deleteTarget.name}?</h2>
            <p>Folders inside it are deleted. Files move to Home unless you choose to delete them too.</p>
            <label className="files-checkbox"><input type="checkbox" checked={deleteFiles} onChange={(event) => setDeleteFiles(event.target.checked)} /><span>Delete files inside this folder</span></label>
            <div className="files-modal-actions">
              <button className="files-button subtle" type="button" disabled={busyId === deleteTarget.id} onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="files-button danger" type="submit" disabled={busyId === deleteTarget.id}>{busyId === deleteTarget.id ? 'Deleting…' : 'Delete folder'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {shareTarget ? (
        <div className="files-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSavingShares) setShareTarget(null) }}>
          <form className="files-modal files-share-modal" role="dialog" aria-modal="true" aria-labelledby="share-resource-title" onSubmit={(event) => void saveShares(event)}>
            <header className="files-modal-heading"><div><span className="files-kicker">SHARE RESOURCE</span><h2 id="share-resource-title">{shareTarget.name}</h2></div><button className="files-icon-button" type="button" onClick={() => setShareTarget(null)} aria-label="Close sharing"><Mark name="close" /></button></header>
            {isLoadingShares ? <div className="files-state compact" role="status"><span className="loading-indicator" /> Loading sharing…</div> : (
              <>
                {canManage(shareTarget.myRole) ? (
                  <label className="files-field"><span>Visibility</span>
                    <select value={shareDraft.visibility} onChange={(event) => setShareDraft((current) => ({ ...current, visibility: event.target.value as ShareDraft['visibility'] }))}>
                      <option value="private">Private</option><option value="organization">Organization</option><option value="public">Public</option>
                    </select>
                  </label>
                ) : <p className="files-readonly-note">Only an owner or admin can change sharing settings.</p>}

                <div className="files-permissions">
                  <h3>People with access</h3>
                  {Object.entries(shareDraft.permissions).length ? Object.entries(shareDraft.permissions).map(([username, role]) => (
                    <div className="files-permission-row" key={username}><span>{username}</span>{canManage(shareTarget.myRole) ? (
                      <div className="files-permission-controls">
                      <select aria-label={`Access for ${username}`} value={role} onChange={(event) => setShareDraft((current) => ({ ...current, permissions: { ...current.permissions, [username]: event.target.value as DriveRole } }))}>
                        {(['admin', 'editor', 'viewer'] as DriveRole[]).map((option) => <option value={option} key={option}>{option}</option>)}
                      </select>
                        <button className="files-remove-permission" type="button" onClick={() => setShareDraft((current) => {
                          const permissions = { ...current.permissions }
                          delete permissions[username]
                          return { ...current, permissions }
                        })}>Remove</button>
                      </div>
                    ) : <small>{role}</small>}</div>
                  )) : <p className="files-muted">No individual access granted.</p>}
                </div>

                {canManage(shareTarget.myRole) ? (
                  <div className="files-add-permission">
                    <label className="files-field"><span>Add username</span><input value={shareUsername} onChange={(event) => setShareUsername(event.target.value)} /></label>
                    <label className="files-field"><span>Role</span><select value={shareRole} onChange={(event) => setShareRole(event.target.value as DriveRole)}><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Admin</option></select></label>
                    <button className="files-button subtle" type="button" onClick={addSharePermission} disabled={!shareUsername.trim()}>Add</button>
                  </div>
                ) : null}

                <div className="files-link-section">
                  <h3>Share link</h3>
                  <div className="files-link-controls">
                    <select aria-label="Share link access" value={shareLinkRole} onChange={(event) => setShareLinkRole(event.target.value as DriveRole)}><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Admin</option></select>
                    <button className="files-button subtle" type="button" onClick={() => void createShareLink()} disabled={isCreatingLink}>{isCreatingLink ? 'Creating…' : shareLinkTokenValue ? 'Rotate link' : 'Create link'}</button>
                  </div>
                  {shareLinkTokenValue ? <div className="files-link-output"><span>Link ready</span><button className="files-button subtle" type="button" onClick={() => void copyShareLink()}>Copy</button><button className="files-button danger" type="button" onClick={() => void revokeShareLink()} disabled={isRevokingLink}>{isRevokingLink ? 'Revoking…' : 'Revoke'}</button></div> : null}
                </div>
              </>
            )}
            <div className="files-modal-actions">
              <button className="files-button subtle" type="button" disabled={isSavingShares} onClick={() => setShareTarget(null)}>Close</button>
              {canManage(shareTarget.myRole) ? <button className="files-button primary" type="submit" disabled={isLoadingShares || isSavingShares}>{isSavingShares ? 'Saving…' : 'Save sharing'}</button> : null}
            </div>
          </form>
        </div>
      ) : null}
    </main>
  )
}

function FilesTopbar({ onBack, onSignOut }: { onBack: () => void; onSignOut: () => void }) {
  return (
    <header className="files-topbar">
      <Brand />
      <div><button className="files-button subtle" type="button" onClick={onBack}><Mark name="back" /> Studio</button><button className="files-button subtle" type="button" onClick={onSignOut}>Sign out</button></div>
    </header>
  )
}

type FileRowProps = {
  name: string
  kind: DriveResourceType
  updatedAt?: string
  role?: string
  isFavorite: boolean
  imageUrl?: string
  detail?: string
  isBusy: boolean
  onOpen: () => void
  onFavorite: () => void
  onRename: () => void
  onMove: () => void
  onShare: () => void
  onDelete?: () => void
  canManage: boolean
}

function FileRow({ name, kind, updatedAt, role, isFavorite, imageUrl, detail, isBusy, onOpen, onFavorite, onRename, onMove, onShare, onDelete, canManage: canShare }: FileRowProps) {
  const mayEdit = canEdit(role)
  return (
    <article className="files-row">
      <button className="files-item-name" type="button" onClick={onOpen} disabled={kind === 'file' && !imageUrl}>
        {imageUrl ? <img className="files-thumbnail" src={imageUrl} alt="" /> : <span className={`files-item-icon ${kind}`}><Mark name={kind === 'folder' ? 'folder' : 'image'} /></span>}
        <span><strong>{name}</strong>{detail ? <small>{detail}</small> : null}</span>
      </button>
      <span className="files-updated">{formatDate(updatedAt) || '—'}</span>
      <span className="files-role">{role ?? 'Access'}</span>
      <div className="files-row-actions">
        <button className={`files-icon-button favorite-button ${isFavorite ? 'is-favorite' : ''}`} type="button" onClick={onFavorite} aria-label={isFavorite ? `Remove ${name} from favorites` : `Add ${name} to favorites`} disabled={isBusy}>
          <Mark name="star" />
        </button>
        <details className="files-action-menu">
          <summary aria-label={`Actions for ${name}`}><Mark name="more" /></summary>
          <div role="menu">
            {mayEdit ? <>
              <button type="button" role="menuitem" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); onRename() }}>Rename</button>
              <button type="button" role="menuitem" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); onMove() }}>Move</button>
            </> : null}
            {canShare ? <button type="button" role="menuitem" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); onShare() }}>Sharing</button> : null}
            {kind === 'folder' && canShare && onDelete ? <button className="danger-text" type="button" role="menuitem" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); onDelete() }}>Delete folder</button> : null}
          </div>
        </details>
      </div>
    </article>
  )
}

type DriveFolderTreeProps = {
  folders: DriveFolder[]
  currentFolderId: string | null
  activePath: string[]
  expandedFolderIds: Set<string>
  isLoading: boolean
  onNavigate: (folderId: string) => void
  onNavigateHome: () => void
  onToggle: (folderId: string) => void
}

function DriveFolderTree({ folders, currentFolderId, activePath, expandedFolderIds, isLoading, onNavigate, onNavigateHome, onToggle }: DriveFolderTreeProps) {
  const rootFolders = folders.filter((folder) => folder.parentId === null)
  return (
    <aside className="files-folder-tree-panel" aria-label="Folder navigation">
      <div className="files-tree-heading"><Mark name="folder" /><span>Folders</span></div>
      <button className={`files-tree-home ${currentFolderId === null ? 'is-current' : ''}`} type="button" onClick={onNavigateHome} aria-current={currentFolderId === null ? 'page' : undefined}>
        <Mark name="home" /> Home
      </button>
      {isLoading ? <div className="files-tree-state" role="status">Loading folders…</div> : rootFolders.length ? (
        <div className="files-tree" role="tree" aria-label="Folders">
          {rootFolders.map((folder) => (
            <DriveFolderTreeBranch
              key={folder.id}
              folder={folder}
              folders={folders}
              currentFolderId={currentFolderId}
              activePath={activePath}
              expandedFolderIds={expandedFolderIds}
              depth={0}
              onNavigate={onNavigate}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : <p className="files-tree-state">No folders yet</p>}
    </aside>
  )
}

type DriveFolderTreeBranchProps = Omit<DriveFolderTreeProps, 'isLoading' | 'onNavigateHome'> & {
  folder: DriveFolder
  depth: number
}

function DriveFolderTreeBranch({ folder, folders, currentFolderId, activePath, expandedFolderIds, depth, onNavigate, onToggle }: DriveFolderTreeBranchProps) {
  const children = folders.filter((candidate) => candidate.parentId === folder.id)
  const isExpanded = expandedFolderIds.has(folder.id)
  const isCurrent = currentFolderId === folder.id

  return (
    <div className="files-tree-branch" role="treeitem" aria-expanded={children.length ? isExpanded : undefined} aria-current={isCurrent ? 'page' : undefined}>
      <div className={`files-tree-row ${isCurrent ? 'is-current' : ''} ${activePath.includes(folder.id) ? 'is-in-path' : ''}`} style={{ paddingLeft: `${6 + depth * 15}px` }}>
        {children.length ? (
          <button className={`files-tree-toggle ${isExpanded ? 'is-expanded' : ''}`} type="button" aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${folder.name}`} onClick={() => onToggle(folder.id)}>
            <Mark name="arrow" />
          </button>
        ) : <span className="files-tree-toggle-placeholder" />}
        <button className="files-tree-folder" type="button" onClick={() => onNavigate(folder.id)} title={folder.name}>
          <Mark name="folder" /><span>{folder.name}</span>
        </button>
      </div>
      {isExpanded && children.length ? (
        <div role="group">
          {children.map((child) => (
            <DriveFolderTreeBranch
              key={child.id}
              folder={child}
              folders={folders}
              currentFolderId={currentFolderId}
              activePath={activePath}
              expandedFolderIds={expandedFolderIds}
              depth={depth + 1}
              onNavigate={onNavigate}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function UploadImagesRow({ onClick, isUploading }: { onClick: () => void; isUploading: boolean }) {
  return (
    <div className="files-upload-row">
      <button type="button" onClick={onClick} disabled={isUploading}>
        <span className="files-upload-row-icon"><Mark name="upload" /></span>
        <span><strong>{isUploading ? 'Uploading images…' : 'Upload images'}</strong><small>Choose images or drag them into this folder</small></span>
      </button>
    </div>
  )
}

export function SharedResourcePage({ token }: { token: string }) {
  const [resource, setResource] = useState<unknown>(null)
  const [resourceType, setResourceType] = useState<DriveResourceType | null>(null)
  const [role, setRole] = useState('viewer')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    getSharedDriveResource(token, { signal: controller.signal })
      .then((result) => {
        setResource(result.resource)
        setResourceType(result.resourceType === 'folder' ? 'folder' : 'file')
        setRole(result.role ?? 'viewer')
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError))
      })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false) })
    return () => controller.abort()
  }, [token])

  const name = getString(resource, 'name', 'title', 'fileName') ?? 'Shared resource'
  const imageUrl = getString(resource, 'imageUrl', 'url', 'thumbnailUrl', 'thumbUrl')

  return (
    <main className="files-page shared-files-page">
      <header className="files-topbar"><Brand /><a className="files-button subtle" href="/">Carpenter Pro</a></header>
      <section className="shared-resource">
        {isLoading ? <div className="files-state" role="status"><span className="loading-indicator" /> Loading shared item…</div> : error ? <p className="files-message error" role="alert">{error}</p> : (
          <>
            <span className="files-modal-icon"><Mark name={resourceType === 'folder' ? 'folder' : 'image'} /></span>
            <span className="files-kicker">SHARED {resourceType?.toUpperCase()} · {role.toUpperCase()}</span>
            <h1>{name}</h1>
            {imageUrl ? <img src={imageUrl} alt={name} /> : <p>This shared folder is available through your organization’s Files workspace.</p>}
          </>
        )}
      </section>
    </main>
  )
}