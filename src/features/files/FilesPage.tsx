import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react'
import { Slide, toast, ToastContainer } from 'react-toastify'
import type { AuthAccount } from '../../shared/auth/types'
import {
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  LoadingState,
  Select,
  TextInput,
  useTheme,
} from '../../shared/ui'
import { Mark } from '../../shared/components/Mark'
import { FileRow } from './components/FileRow'
import { DriveFolderTree } from './components/FolderTree'
import { UploadImagesRow } from './components/UploadImagesRow'
import { canEdit, canManage } from './filesPermissions'
import {
  asShareDraft,
  createDriveFolder,
  createDriveShareLink,
  deleteDriveFolder,
  getDriveActivity,
  getDriveResourceShares,
  getString,
  listDriveContents,
  loadDriveFolderTree,
  moveDriveFile,
  moveDriveFolder,
  renameDriveResource,
  revokeDriveShareLink,
  shareDriveResource,
  shareLinkToken,
  toggleDriveFavorite,
  uploadDriveImage,
  type DriveFile,
  type DriveFolder,
  type DriveResourceType,
  type DriveRole,
  type ShareDraft,
} from './filesService'
import { errorMessage, formatDate, isDescendant, isImageFile } from './filesUtils'
import 'react-toastify/dist/ReactToastify.css'
import './FilesPage.css'

type FilesPageProps = {
  account: AuthAccount
  onBack: () => void
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

type FilesViewMode = 'large' | 'small' | 'list'

export function FilesPage({ account, onBack }: FilesPageProps) {
  const { theme } = useTheme()
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

  useEffect(() => {
    document.title = `${currentFolder ? `${currentFolder.name} · ` : ''}Files · Carpenter Pro`
  }, [currentFolder])

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

  const confirmDeleteFolder = async () => {
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
      <main className="files-page app-enter-fade">
        <EmptyState
          className="files-access-message"
          icon="folder"
          headingLevel={1}
          title="Files access unavailable"
          description="This account doesn’t have permission to open Files. Contact your organization administrator for access."
          actions={<Button variant="primary" shape="pill" icon="back" onClick={onBack}>Back to studio</Button>}
        />
      </main>
    )
  }

  return (
    <main className="files-page app-enter-fade">
      <ToastContainer position="bottom-right" autoClose={3500} newestOnTop closeOnClick pauseOnHover theme={theme} limit={4} transition={Slide} />
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
            <h1>Files</h1>
            <p>Your saved renders and folders.</p>
          </div>
          <div className="files-heading-actions">
            <Button variant="ghost" shape="pill" icon="back" onClick={onBack}>Studio</Button>
            <Button shape="pill" icon="activity" onClick={() => void toggleActivity()} aria-expanded={isActivityOpen}>
              Activity
            </Button>
          </div>
        </header>

        <nav className="files-breadcrumbs" aria-label="Folder path">
          <button type="button" onClick={() => setFolderPath([])} aria-current={folderPath.length === 0 ? 'page' : undefined}>
            <Mark name="home" /> Home
          </button>
          {folderPath.map((folder, index) => (
            <span className="files-breadcrumb-item" key={folder.id}>
              <Mark name="arrow" />
              <button type="button" onClick={() => setFolderPath((current) => current.slice(0, index + 1))} aria-current={index === folderPath.length - 1 ? 'page' : undefined}>
                <span>{folder.name}</span>
              </button>
            </span>
          ))}
        </nav>

        <div className="files-toolbar">
          <TextInput
            className="files-search"
            type="search"
            startIcon="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search files and folders"
            aria-label="Search files and folders"
          />
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
            <Button shape="pill" icon="star" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly((value) => !value)}>
              Favorites
            </Button>
            <Button shape="pill" iconOnly icon="refresh" onClick={refresh} aria-label="Refresh files" tooltip="Refresh" />
            {account.capabilities?.canSaveToFiles ? (
              <Button
                shape="pill"
                icon="upload"
                onClick={() => uploadInput.current?.click()}
                disabled={!canUploadHere}
                loading={isUploading}
                loadingLabel={`Uploading ${uploadProgress.completed}/${uploadProgress.total}`}
                title={!canUploadHere ? 'You need editor access to upload into this folder.' : undefined}
              >
                Upload images
              </Button>
            ) : null}
            <Button variant="primary" shape="pill" icon="plus" onClick={() => { setFolderName(''); setIsCreateFolderOpen(true) }} disabled={!canCreateHere} title={!canCreateHere ? 'You need editor access to create a folder here.' : undefined}>
              New folder
            </Button>
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
              <LoadingState label="Loading files…" />
            ) : folders.length || files.length ? (
              <div className="files-list app-enter">
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
              <EmptyState
                icon={search || favoritesOnly ? 'search' : 'folder'}
                title={search ? 'No matching items' : favoritesOnly ? 'No favorites yet' : 'This folder is empty'}
                description={search ? 'Try another search.' : favoritesOnly ? 'Favorite a file or folder to find it here.' : canUploadHere ? 'Upload images or generate a render to see it here.' : 'Create a folder or generate a render to see it here.'}
                actions={search ? (
                  <Button shape="pill" onClick={() => setSearch('')}>Clear search</Button>
                ) : favoritesOnly ? (
                  <Button shape="pill" onClick={() => setFavoritesOnly(false)}>Show all items</Button>
                ) : canCreateHere ? (
                  <>
                    {canUploadHere ? <Button shape="pill" icon="upload" onClick={() => uploadInput.current?.click()} loading={isUploading}>Upload images</Button> : null}
                    <Button variant="primary" shape="pill" icon="plus" onClick={() => setIsCreateFolderOpen(true)}>New folder</Button>
                  </>
                ) : undefined}
              />
            )}
          </section>

          {isActivityOpen ? (
            <aside className="files-activity-panel app-enter-end" aria-label="Recent activity">
              <header><h2>Activity</h2><Button variant="ghost" size="sm" iconOnly icon="close" onClick={() => setIsActivityOpen(false)} aria-label="Close activity" /></header>
              {isLoadingActivity ? <LoadingState compact label="Loading activity…" /> : activity.length ? (
                <ul>
                  {activity.map((item, index) => (
                    <li key={getString(item, 'id', 'activityId') ?? `activity-${index}`}>
                      <strong>{getString(item, 'action', 'event', 'kind', 'type') ?? 'File activity'}</strong>
                      <span>{getString(item, 'resourceName', 'name', 'message') ?? 'A resource was updated'}</span>
                      <time>{formatDate(getString(item, 'createdAt', 'timestamp'))}</time>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState compact icon="activity" headingLevel={3} title="No activity yet" description="Changes to files and folders appear here." />}
            </aside>
          ) : null}
        </div>
      </div>

      <Dialog
        open={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        title="New folder"
        description={`Create a folder in ${currentFolder?.name ?? 'Home'}.`}
        size="sm"
        icon="folder"
        dismissible={!isCreatingFolder}
        onSubmit={(event) => void createFolder(event)}
        footer={(
          <>
            <Button shape="pill" disabled={isCreatingFolder} onClick={() => setIsCreateFolderOpen(false)}>Cancel</Button>
            <Button variant="primary" shape="pill" type="submit" disabled={!folderName.trim()} loading={isCreatingFolder} loadingLabel="Creating…">Create folder</Button>
          </>
        )}
      >
        <Field label="Folder name">
          <TextInput autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} maxLength={120} required />
        </Field>
      </Dialog>

      {moveTarget ? (
        <Dialog
          open
          onClose={() => setMoveTarget(null)}
          title={`Move ${moveTarget.resourceType}`}
          description={<>Choose a destination for <strong>{moveTarget.name}</strong>.</>}
          size="sm"
          icon="folder"
          dismissible={!isLoadingMoveFolders && busyId !== moveTarget.id}
          onSubmit={(event) => void moveResource(event)}
          footer={(
            <>
              <Button shape="pill" disabled={busyId === moveTarget.id} onClick={() => setMoveTarget(null)}>Cancel</Button>
              <Button variant="primary" shape="pill" type="submit" disabled={isLoadingMoveFolders} loading={busyId === moveTarget.id} loadingLabel="Moving…">Move</Button>
            </>
          )}
        >
          {isLoadingMoveFolders ? <LoadingState compact label="Loading folders…" /> : (
            <Field label="Destination">
              <Select autoFocus value={moveDestination} onChange={(event) => setMoveDestination(event.target.value)}>
                <option value="">Home</option>
                {destinationFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
              </Select>
            </Field>
          )}
        </Dialog>
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          open
          tone="danger"
          title={`Delete ${deleteTarget.name}?`}
          description="Folders inside it are deleted. Files move to Home unless you choose to delete them too."
          confirmLabel="Delete folder"
          loading={busyId === deleteTarget.id}
          loadingLabel="Deleting…"
          onConfirm={() => void confirmDeleteFolder()}
          onCancel={() => setDeleteTarget(null)}
        >
          <label className="files-checkbox">
            <input type="checkbox" checked={deleteFiles} onChange={(event) => setDeleteFiles(event.target.checked)} />
            <span>Delete files inside this folder</span>
          </label>
        </ConfirmDialog>
      ) : null}

      {shareTarget ? (
        <Dialog
          open
          onClose={() => setShareTarget(null)}
          title={`Share “${shareTarget.name}”`}
          dismissible={!isSavingShares}
          onSubmit={(event) => void saveShares(event)}
          className="files-share-dialog"
          footer={(
            <>
              <Button shape="pill" disabled={isSavingShares} onClick={() => setShareTarget(null)}>Close</Button>
              {canManage(shareTarget.myRole) ? <Button variant="primary" shape="pill" type="submit" disabled={isLoadingShares} loading={isSavingShares} loadingLabel="Saving…">Save sharing</Button> : null}
            </>
          )}
        >
            {isLoadingShares ? <LoadingState compact label="Loading sharing…" /> : (
              <>
                {canManage(shareTarget.myRole) ? (
                  <Field label="Visibility">
                    <Select value={shareDraft.visibility} onChange={(event) => setShareDraft((current) => ({ ...current, visibility: event.target.value as ShareDraft['visibility'] }))}>
                      <option value="private">Private</option><option value="organization">Organization</option><option value="public">Public</option>
                    </Select>
                  </Field>
                ) : <p className="files-readonly-note">Only an owner or admin can change sharing settings.</p>}

                <div className="files-permissions">
                  <h3>People with access</h3>
                  {Object.entries(shareDraft.permissions).length ? Object.entries(shareDraft.permissions).map(([username, role]) => (
                    <div className="files-permission-row" key={username}><span>{username}</span>{canManage(shareTarget.myRole) ? (
                      <div className="files-permission-controls">
                        <Select size="sm" aria-label={`Access for ${username}`} value={role} onChange={(event) => setShareDraft((current) => ({ ...current, permissions: { ...current.permissions, [username]: event.target.value as DriveRole } }))}>
                          {(['admin', 'editor', 'viewer'] as DriveRole[]).map((option) => <option value={option} key={option}>{option}</option>)}
                        </Select>
                        <Button variant="destructive" size="xs" shape="pill" onClick={() => setShareDraft((current) => {
                          const permissions = { ...current.permissions }
                          delete permissions[username]
                          return { ...current, permissions }
                        })}>Remove</Button>
                      </div>
                    ) : <small>{role}</small>}</div>
                  )) : <p className="files-muted">No individual access granted.</p>}
                </div>

                {canManage(shareTarget.myRole) ? (
                  <div className="files-add-permission">
                    <Field label="Add username"><TextInput value={shareUsername} onChange={(event) => setShareUsername(event.target.value)} /></Field>
                    <Field label="Role">
                      <Select value={shareRole} onChange={(event) => setShareRole(event.target.value as DriveRole)}><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Admin</option></Select>
                    </Field>
                    <Button shape="pill" onClick={addSharePermission} disabled={!shareUsername.trim()}>Add</Button>
                  </div>
                ) : null}

                <div className="files-link-section">
                  <h3>Share link</h3>
                  <div className="files-link-controls">
                    <Select aria-label="Share link access" value={shareLinkRole} onChange={(event) => setShareLinkRole(event.target.value as DriveRole)}><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Admin</option></Select>
                    <Button shape="pill" onClick={() => void createShareLink()} loading={isCreatingLink} loadingLabel="Creating…">{shareLinkTokenValue ? 'Rotate link' : 'Create link'}</Button>
                  </div>
                  {shareLinkTokenValue ? (
                    <div className="files-link-output">
                      <span>Link ready</span>
                      <Button size="sm" shape="pill" onClick={() => void copyShareLink()}>Copy</Button>
                      <Button variant="destructive" size="sm" shape="pill" onClick={() => void revokeShareLink()} loading={isRevokingLink} loadingLabel="Revoking…">Revoke</Button>
                    </div>
                  ) : null}
                </div>
              </>
            )}
        </Dialog>
      ) : null}
    </main>
  )
}
