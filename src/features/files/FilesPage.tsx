import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react'
import { Slide, toast, ToastContainer } from 'react-toastify'
import type { AuthAccount } from '../../shared/auth/types'
import { createLaminateCollection, deleteCollection, deleteProduct, uploadLaminateProducts } from '../../shared/catalog/catalogService'
import type { Collection, Product } from '../../shared/catalog/catalogTypes'
import {
  Alert,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  MenuItem,
  MenuSeparator,
  Select,
  Skeleton,
  SkeletonGroup,
  SkeletonText,
  TextInput,
  useTheme,
} from '../../shared/ui'
import { Mark } from '../../shared/components/Mark'
import { FileRow, FileRowSkeleton } from './components/FileRow'
import { FilesSidebar, type FilesNavItem, type FilesSection } from './components/FilesSidebar'
import { DriveFolderTree } from './components/FolderTree'
import { canEdit, canManage, isShared } from './filesPermissions'
import {
  asShareDraft,
  createDriveFolder,
  createDriveShareLink,
  deleteDriveFolder,
  getDriveActivity,
  getDriveResourceShares,
  getString,
  listDriveContents,
  listRenderLinks,
  loadDriveIndex,
  moveDriveFile,
  moveDriveFolder,
  renameDriveResource,
  revokeDriveShareLink,
  setRenderLinkRevoked,
  shareDriveResource,
  shareLinkToken,
  toggleDriveFavorite,
  type DriveContents,
  type DriveFile,
  type DriveFolder,
  type DriveResourceType,
  type DriveRole,
  type RenderLink,
  type ShareDraft,
} from './filesService'
import { errorMessage, formatDate, isDescendant, isImageFile } from './filesUtils'
import { useLibrary } from './useLibrary'
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

type LibraryDeleteTarget = { kind: 'collection'; item: Collection } | { kind: 'product'; item: Product }

type FilesViewMode = 'large' | 'small' | 'list'

/** How many of the newest files Recent shows. */
const RECENT_LIMIT = 30

/**
 * The sections of Files. My Files is the folder view; All Assets, Recent, Favorites, Shared,
 * Renders and Sources are different cuts of the same files; Library is the laminate
 * collections (the one place images are uploaded); Links are public render links.
 */
const SECTIONS: FilesNavItem[] = [
  { id: 'files', label: 'My Files', icon: 'folder' },
  { id: 'assets', label: 'All Assets', icon: 'layers' },
  { id: 'recent', label: 'Recent', icon: 'clock' },
  { id: 'favorites', label: 'Favorites', icon: 'star' },
  { id: 'shared', label: 'Shared', icon: 'share' },
  { id: 'library', label: 'Library', icon: 'gridLarge', divided: true },
  { id: 'renders', label: 'Renders', icon: 'spark', divided: true },
  { id: 'sources', label: 'Sources', icon: 'image' },
  { id: 'links', label: 'Links', icon: 'link' },
]

const EMPTY_COPY: Record<Exclude<FilesSection, 'files' | 'library'>, { title: string; description: string }> = {
  assets: { title: 'No assets yet', description: 'Renders you save to Files appear here, whichever folder they are in.' },
  recent: { title: 'Nothing recent', description: 'Your latest files appear here.' },
  favorites: { title: 'No favorites yet', description: 'Favorite a file or folder to find it here.' },
  shared: { title: 'Nothing shared', description: 'Files and folders shared with you, or that you share with your organization, appear here.' },
  renders: { title: 'No renders yet', description: 'Generate a render in the studio and save it to Files to see it here.' },
  sources: { title: 'No sources yet', description: 'The laminate textures your saved renders were made from appear here.' },
  links: { title: 'No render links yet', description: 'Public links to your renders appear here once they are created.' },
}

function fileTime(file: DriveFile): number {
  return Date.parse(file.updatedAt ?? file.createdAt ?? '') || 0
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

export function FilesPage({ account, onBack }: FilesPageProps) {
  const { theme } = useTheme()
  const [section, setSection] = useState<FilesSection>('files')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [folderPath, setFolderPath] = useState<DriveFolder[]>([])
  const [folders, setFolders] = useState<DriveFolder[]>([])
  // Every folder and file in the user's Files: the folder tree, and the sections that cut across folders.
  const [driveIndex, setDriveIndex] = useState<DriveContents>({ folders: [], files: [] })
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => new Set())
  const [files, setFiles] = useState<DriveFile[]>([])
  const [links, setLinks] = useState<RenderLink[] | null>(null)
  const [viewMode, setViewMode] = useState<FilesViewMode>('list')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingIndex, setIsLoadingIndex] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [createTarget, setCreateTarget] = useState<'folder' | 'collection' | null>(null)
  const [newName, setNewName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null)
  const [moveFolders, setMoveFolders] = useState<DriveFolder[]>([])
  const [moveDestination, setMoveDestination] = useState('')
  const [isLoadingMoveFolders, setIsLoadingMoveFolders] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DriveFolder | null>(null)
  const [deleteFiles, setDeleteFiles] = useState(false)
  const [libraryDeleteTarget, setLibraryDeleteTarget] = useState<LibraryDeleteTarget | null>(null)
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
  const uploadInput = useRef<HTMLInputElement>(null)

  const currentFolder = folderPath.at(-1) ?? null
  const currentFolderId = currentFolder?.id ?? null
  const folderTree = driveIndex.folders
  const capabilities = account.capabilities
  const hasFilesAccess = capabilities?.filesAccess !== undefined && capabilities.filesAccess !== 'none'
  // The API allows managing folders and files for `full` and `unrestricted`; `laminates` is view-only.
  const hasFullFilesAccess = capabilities?.filesAccess === 'full' || capabilities?.filesAccess === 'unrestricted'
  const isViewOnlyAccount = hasFilesAccess && !hasFullFilesAccess
  // Folders are created in the open folder in My Files, and at Home from the other sections.
  const canCreateFolder = hasFullFilesAccess && (section !== 'files' || !currentFolder || canEdit(currentFolder.myRole))
  // The library follows the same capabilities as in the studio: who may see it, and who may add to it.
  const canBrowseLibrary = Boolean(capabilities?.laminateSource && capabilities.laminateSource !== 'none')
  const canManageLibrary = capabilities?.canUploadLaminate === true

  const isDriveSection = section !== 'library' && section !== 'links'
  const searchTerm = search.trim()

  const library = useLibrary(
    account.username,
    hasFilesAccess && canBrowseLibrary && section === 'library',
    searchTerm,
    (error) => toast.error(errorMessage(error)),
  )
  const openCollection = library.openCollection
  const canUploadHere = section === 'library' && canManageLibrary && openCollection !== null

  // My Files: the open folder, or a search across folders.
  useEffect(() => {
    if (!hasFilesAccess || section !== 'files') return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setIsLoading(true)
      listDriveContents(account.username, currentFolderId, searchTerm, false, { signal: controller.signal })
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
    }, searchTerm ? 220 : 0)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [account.username, currentFolderId, hasFilesAccess, reloadKey, searchTerm, section])

  useEffect(() => {
    if (!hasFilesAccess) return
    const controller = new AbortController()
    loadDriveIndex(account.username, { signal: controller.signal })
      .then(setDriveIndex)
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) toast.error(errorMessage(requestError))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingIndex(false)
      })
    return () => controller.abort()
  }, [account.username, hasFilesAccess, reloadKey])

  useEffect(() => {
    if (!hasFilesAccess || section !== 'links') return
    const controller = new AbortController()
    listRenderLinks(account.username, { signal: controller.signal })
      .then(setLinks)
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        setLinks([])
        toast.error(errorMessage(requestError))
      })
    return () => controller.abort()
  }, [account.username, hasFilesAccess, reloadKey, section])

  const sectionLabel = SECTIONS.find((item) => item.id === section)?.label ?? 'Files'
  const locationLabel = section === 'files' ? currentFolder?.name : section === 'library' ? openCollection?.name : undefined

  useEffect(() => {
    document.title = `${locationLabel ?? sectionLabel} · Files · Carpenter Pro`
  }, [locationLabel, sectionLabel])

  const refresh = () => {
    setReloadKey((value) => value + 1)
    if (section === 'library') library.reload()
  }

  const selectSection = (next: FilesSection) => {
    setSection(next)
    setSearch('')
    setIsDragActive(false)
  }

  const openFolder = (folder: DriveFolder) => {
    setFolderPath((current) => {
      const existingIndex = current.findIndex((item) => item.id === folder.id)
      if (existingIndex >= 0) return current.slice(0, existingIndex + 1)
      if (folder.parentId === (current.at(-1)?.id ?? null)) return [...current, folder]
      return [folder]
    })
    setSearch('')
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
  }

  // From the tree, or from a folder listed in another section: open it in My Files.
  const navigateToFolderFromTree = (folderId: string) => {
    const foldersById = new Map(folderTree.map((folder) => [folder.id, folder]))
    const ancestors: string[] = []
    let folder = foldersById.get(folderId)
    while (folder?.parentId) {
      ancestors.push(folder.parentId)
      folder = foldersById.get(folder.parentId)
    }
    setExpandedFolderIds((current) => new Set([...current, ...ancestors]))
    setSection('files')
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

  // Images are uploaded only into a Library collection, where each becomes a laminate.
  const uploadToLibrary = async (incomingFiles: File[]) => {
    if (!canUploadHere || !openCollection) {
      toast.warning('Open a collection in the Library to upload images.')
      return
    }
    const images = incomingFiles.filter(isImageFile)
    if (!images.length) {
      toast.warning('Choose image files to upload.')
      return
    }
    const skippedCount = incomingFiles.length - images.length
    if (skippedCount) toast.warning(`${skippedCount} non-image file${skippedCount === 1 ? ' was' : 's were'} skipped.`)

    setIsUploading(true)
    try {
      const result = await uploadLaminateProducts(account.username, openCollection.id, images)
      const added = result.productsCreated ?? result.products?.length ?? images.length
      toast.success(`${plural(added, 'laminate')} added to ${openCollection.name}.`)
      library.reload()
    } catch (uploadError) {
      toast.error(errorMessage(uploadError))
    } finally {
      setIsUploading(false)
    }
  }

  const handleUploadSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    void uploadToLibrary(selectedFiles)
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
    if (canUploadHere) void uploadToLibrary(Array.from(event.dataTransfer.files))
  }

  const runMutation = async (id: string, action: () => Promise<unknown>, successMessage: string, afterSuccess: () => void = refresh) => {
    setBusyId(id)
    try {
      await action()
      toast.success(successMessage)
      afterSuccess()
    } catch (requestError) {
      toast.error(errorMessage(requestError))
    } finally {
      setBusyId(null)
    }
  }

  const openCreateDialog = (target: 'folder' | 'collection') => {
    setNewName('')
    setCreateTarget(target)
  }

  const createItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = newName.trim()
    if (!name || !createTarget) return
    setIsCreating(true)
    try {
      if (createTarget === 'collection') {
        await createLaminateCollection(account.username, name)
        toast.success(`Collection “${name}” created.`)
        library.reload()
      } else {
        await createDriveFolder(account.username, name, section === 'files' ? currentFolderId : null)
        toast.success(`Folder “${name}” created.`)
        // Created at Home from another section: go there to show it.
        if (section !== 'files') {
          setSection('files')
          setFolderPath([])
          setSearch('')
        }
        refresh()
      }
      setCreateTarget(null)
    } catch (requestError) {
      toast.error(errorMessage(requestError))
    } finally {
      setIsCreating(false)
    }
  }

  const renameResource = async (resource: DriveFolder | DriveFile, resourceType: DriveResourceType) => {
    const nextName = window.prompt(`Rename ${resourceType}`, resource.name)?.trim()
    if (!nextName || nextName === resource.name) return
    await runMutation(resource.id, async () => {
      const result = await renameDriveResource(account.username, resource.id, resourceType, nextName)
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
      setMoveFolders((await loadDriveIndex(account.username)).folders)
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

  const confirmLibraryDelete = async () => {
    const target = libraryDeleteTarget
    if (!target) return
    await runMutation(
      target.item.id,
      () => (target.kind === 'collection'
        ? deleteCollection(account.username, target.item.id)
        : deleteProduct(account.username, target.item.id)),
      `${target.item.name} deleted.`,
      () => {
        if (target.kind === 'collection' && openCollection?.id === target.item.id) library.open(null)
        library.reload()
      },
    )
    setLibraryDeleteTarget(null)
  }

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast.info('Link copied.')
    } catch {
      toast.error('Unable to copy the link in this browser.')
    }
  }

  const toggleRenderLink = (link: RenderLink) => runMutation(link.token, async () => {
    const result = await setRenderLinkRevoked(account.username, link.token, !link.revoked)
    if (!result.success) throw new Error('The link could not be updated.')
  }, link.revoked ? 'Link enabled.' : 'Link disabled.')

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
      refresh()
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
      const result = await getDriveActivity(account.username, section === 'files' ? currentFolderId : null)
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

  /* What the open section lists. My Files asks the API; the other Drive sections are cuts of the index. */

  const matchesSearch = (name: string) => !searchTerm || name.toLowerCase().includes(searchTerm.toLowerCase())
  const newestFirst = (items: DriveFile[]) => [...items].sort((a, b) => fileTime(b) - fileTime(a))
  const favoriteFolders = folderTree.filter((folder) => folder.isFavorite)
  const favoriteFiles = driveIndex.files.filter((file) => file.isFavorite)
  const sharedFolders = folderTree.filter(isShared)
  const sharedFiles = driveIndex.files.filter(isShared)
  const renderFiles = driveIndex.files.filter((file) => !file.isUpload)
  const sourceFiles = driveIndex.files.filter((file) => file.baseImageUrl)

  let shownFolders: DriveFolder[] = []
  let shownFiles: DriveFile[] = []
  if (section === 'files') {
    shownFolders = folders
    shownFiles = files
  } else if (isDriveSection) {
    if (section === 'favorites') shownFolders = favoriteFolders
    if (section === 'shared') shownFolders = sharedFolders
    const sectionFiles = section === 'assets' ? driveIndex.files
      : section === 'recent' ? newestFirst(driveIndex.files).slice(0, RECENT_LIMIT)
        : section === 'favorites' ? favoriteFiles
          : section === 'shared' ? sharedFiles
            : section === 'renders' ? renderFiles
              : sourceFiles
    shownFolders = shownFolders.filter((folder) => matchesSearch(folder.name))
    shownFiles = newestFirst(sectionFiles).filter((file) => matchesSearch(file.name))
  }
  const shownLinks = (links ?? []).filter((link) => matchesSearch(link.title))
  const folderNames = new Map(folderTree.map((folder) => [folder.id, folder.name]))

  const navItems = SECTIONS
    .filter((item) => item.id !== 'library' || canBrowseLibrary)
    .map((item) => (isLoadingIndex ? item : {
      ...item,
      count: item.id === 'assets' ? driveIndex.files.length
        : item.id === 'favorites' ? favoriteFolders.length + favoriteFiles.length
          : item.id === 'shared' ? sharedFolders.length + sharedFiles.length
            : item.id === 'renders' ? renderFiles.length
              : item.id === 'sources' ? sourceFiles.length
                : undefined,
    }))

  const isListLoading = section === 'files' ? isLoading
    : section === 'library' ? library.isLoading
      : section === 'links' ? links === null
        : isLoadingIndex
  const itemCount = section === 'library' ? (openCollection ? library.products.length : library.collections.length)
    : section === 'links' ? shownLinks.length
      : shownFolders.length + shownFiles.length

  const emptyCopy = searchTerm
    ? { title: 'No matching items', description: 'Try another search.' }
    : section === 'files'
      ? { title: 'This folder is empty', description: canCreateFolder ? 'Create a folder, or save a render to Files to see it here.' : 'Renders you save to Files appear here.' }
      : section === 'library'
        ? openCollection
          ? { title: 'This collection is empty', description: canManageLibrary ? 'Upload images to add laminates to it.' : 'Laminates added to this collection appear here.' }
          : { title: 'No collections yet', description: canManageLibrary ? 'Create a collection, then upload laminate images into it.' : 'Collections shared with you appear here.' }
        : EMPTY_COPY[section]

  const openImage = (url?: string) => (url ? () => window.open(url, '_blank', 'noopener,noreferrer') : undefined)

  const folderRow = (folder: DriveFolder) => {
    const role = hasFullFilesAccess ? folder.myRole : 'viewer'
    const mayEdit = canEdit(role)
    const mayManage = hasFullFilesAccess && canManage(folder.myRole)
    return (
      <FileRow
        key={`folder-${folder.id}`}
        name={folder.name}
        kind="folder"
        updatedAt={folder.updatedAt}
        meta={role ?? 'Access'}
        isFavorite={folder.isFavorite}
        isBusy={busyId === folder.id}
        onOpen={() => (section === 'files' ? openFolder(folder) : navigateToFolderFromTree(folder.id))}
        onFavorite={() => void toggleFavorite(folder, 'folder')}
        menu={mayEdit || mayManage ? (
          <>
            {mayEdit ? (
              <>
                <MenuItem onSelect={() => void renameResource(folder, 'folder')}>Rename</MenuItem>
                <MenuItem onSelect={() => void openMoveDialog(folder, 'folder')}>Move</MenuItem>
              </>
            ) : null}
            {mayManage ? (
              <>
                <MenuItem onSelect={() => void openShareDialog({ id: folder.id, name: folder.name, resourceType: 'folder', myRole: folder.myRole })}>Sharing</MenuItem>
                <MenuSeparator />
                <MenuItem tone="danger" icon="trash" onSelect={() => { setDeleteTarget(folder); setDeleteFiles(false) }}>Delete folder</MenuItem>
              </>
            ) : null}
          </>
        ) : undefined}
      />
    )
  }

  const fileRow = (file: DriveFile) => {
    // Sources lists the laminate a render was made from, not the render itself.
    if (section === 'sources') {
      return (
        <FileRow
          key={`source-${file.id}`}
          name={file.name}
          kind="file"
          imageUrl={file.baseImageUrl}
          detail="Source texture"
          updatedAt={file.updatedAt ?? file.createdAt}
          onOpen={openImage(file.baseImageUrl)}
        />
      )
    }
    const role = hasFullFilesAccess ? file.myRole : 'viewer'
    const mayEdit = canEdit(role)
    const mayManage = hasFullFilesAccess && canManage(file.myRole)
    return (
      <FileRow
        key={`file-${file.id}`}
        name={file.name}
        kind="file"
        imageUrl={file.thumbUrl ?? file.imageUrl}
        // Outside My Files, say which folder the file is in.
        detail={section === 'files' ? file.tool : file.parentId ? `In ${folderNames.get(file.parentId) ?? 'a folder'}` : 'In My Files'}
        updatedAt={file.updatedAt ?? file.createdAt}
        meta={role ?? 'Access'}
        isFavorite={file.isFavorite}
        isBusy={busyId === file.id}
        onOpen={openImage(file.imageUrl)}
        onFavorite={() => void toggleFavorite(file, 'file')}
        menu={mayEdit || mayManage ? (
          <>
            {mayEdit ? (
              <>
                <MenuItem onSelect={() => void renameResource(file, 'file')}>Rename</MenuItem>
                <MenuItem onSelect={() => void openMoveDialog(file, 'file')}>Move</MenuItem>
              </>
            ) : null}
            {mayManage ? (
              <MenuItem onSelect={() => void openShareDialog({ id: file.id, name: file.name, resourceType: 'file', myRole: file.myRole })}>Sharing</MenuItem>
            ) : null}
          </>
        ) : undefined}
      />
    )
  }

  // Library: collections open like folders; inside one are its laminates.
  const libraryRows = openCollection
    ? library.products.map((product) => (
      <FileRow
        key={`product-${product.id}`}
        name={product.name}
        kind="file"
        imageUrl={product.thumbUrl ?? product.coverThumbUrl ?? product.imageUrl}
        detail="Laminate"
        isBusy={busyId === product.id}
        onOpen={openImage(product.imageUrl ?? product.thumbUrl ?? product.coverThumbUrl)}
        menu={canManageLibrary ? (
          <MenuItem tone="danger" icon="trash" onSelect={() => setLibraryDeleteTarget({ kind: 'product', item: product })}>Delete laminate</MenuItem>
        ) : undefined}
      />
    ))
    : library.collections.map((collection) => (
      <FileRow
        key={`collection-${collection.id}`}
        name={collection.name}
        kind="folder"
        detail={typeof collection.productCount === 'number' ? plural(collection.productCount, 'laminate') : 'Collection'}
        isBusy={busyId === collection.id}
        onOpen={() => { setSearch(''); library.open(collection) }}
        menu={canManageLibrary ? (
          <MenuItem tone="danger" icon="trash" onSelect={() => setLibraryDeleteTarget({ kind: 'collection', item: collection })}>Delete collection</MenuItem>
        ) : undefined}
      />
    ))

  const linkRows = shownLinks.map((link) => (
    <FileRow
      key={`link-${link.token}`}
      name={link.title}
      kind="file"
      icon="link"
      detail={link.url}
      updatedAt={link.createdAt}
      meta={link.revoked ? 'Disabled' : plural(link.views, 'view')}
      isBusy={busyId === link.token}
      onOpen={link.revoked ? undefined : openImage(link.url)}
      menu={(
        <>
          <MenuItem onSelect={() => void copyLink(link.url)}>Copy link</MenuItem>
          <MenuSeparator />
          <MenuItem tone={link.revoked ? undefined : 'danger'} onSelect={() => void toggleRenderLink(link)}>
            {link.revoked ? 'Enable link' : 'Disable link'}
          </MenuItem>
        </>
      )}
    />
  ))

  const newFolderButton = isViewOnlyAccount ? null : (
    <Button
      variant="primary"
      size="sm"
      shape="pill"
      icon="plus"
      onClick={() => openCreateDialog('folder')}
      disabled={!canCreateFolder}
      title={!canCreateFolder ? 'You need editor access to create a folder here.' : undefined}
    >
      New folder
    </Button>
  )
  const uploadButton = (
    <Button variant="primary" size="sm" shape="pill" icon="upload" onClick={() => uploadInput.current?.click()} loading={isUploading} loadingLabel="Uploading…">
      Upload images
    </Button>
  )
  const primaryAction = section === 'library'
    ? canManageLibrary
      ? openCollection ? uploadButton : <Button variant="primary" size="sm" shape="pill" icon="plus" onClick={() => openCreateDialog('collection')}>New collection</Button>
      : null
    : section === 'links' ? null : newFolderButton

  return (
    <main className="files-page files-workspace app-enter-fade">
      <ToastContainer position="bottom-right" autoClose={3500} newestOnTop closeOnClick pauseOnHover theme={theme} limit={4} transition={Slide} />
      <h1 className="sr-only">Files</h1>

      <FilesSidebar
        items={navItems}
        active={section}
        onSelect={selectSection}
        collapsed={isSidebarCollapsed}
        onToggleCollapsed={() => setIsSidebarCollapsed((value) => !value)}
      >
        {section === 'files' ? (
          <DriveFolderTree
            folders={folderTree}
            currentFolderId={currentFolderId}
            activePath={folderPath.map((folder) => folder.id)}
            expandedFolderIds={expandedFolderIds}
            isLoading={isLoadingIndex}
            onNavigate={navigateToFolderFromTree}
            onToggle={toggleFolderTreeNode}
          />
        ) : null}
      </FilesSidebar>

      <div
        className={`files-main ${isDragActive ? 'is-drag-active' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input ref={uploadInput} className="files-upload-input" type="file" accept="image/*" multiple onChange={handleUploadSelection} tabIndex={-1} />
        {isDragActive ? (
          <div className="files-drop-overlay" aria-hidden="true">
            <Mark name="upload" /><strong>Drop images to upload</strong><span>They will be added to {openCollection?.name ?? 'this collection'}</span>
          </div>
        ) : null}

        <header className="files-topbar">
          <nav className="files-breadcrumbs" aria-label="Location">
            <button
              type="button"
              onClick={() => (section === 'files' ? setFolderPath([]) : section === 'library' ? library.open(null) : undefined)}
              aria-current={locationLabel ? undefined : 'page'}
            >
              <Mark name={SECTIONS.find((item) => item.id === section)?.icon ?? 'folder'} /> {sectionLabel}
            </button>
            {section === 'files' ? folderPath.map((folder, index) => (
              <span className="files-breadcrumb-item" key={folder.id}>
                <Mark name="arrow" />
                <button type="button" onClick={() => setFolderPath((current) => current.slice(0, index + 1))} aria-current={index === folderPath.length - 1 ? 'page' : undefined}>
                  <span>{folder.name}</span>
                </button>
              </span>
            )) : null}
            {section === 'library' && openCollection ? (
              <span className="files-breadcrumb-item">
                <Mark name="arrow" />
                <button type="button" aria-current="page"><span>{openCollection.name}</span></button>
              </span>
            ) : null}
          </nav>

          <div className="files-toolbar">
            <TextInput
              className="files-search"
              type="search"
              size="sm"
              startIcon="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${(locationLabel ?? sectionLabel).toLowerCase()}`}
              aria-label={`Search ${locationLabel ?? sectionLabel}`}
            />
            <div className="files-view-switch" role="group" aria-label="View">
              <button className={viewMode === 'large' ? 'is-active' : ''} type="button" aria-label="Large icon view" aria-pressed={viewMode === 'large'} title="Large icons" onClick={() => setViewMode('large')}>
                <Mark name="gridLarge" />
              </button>
              <button className={viewMode === 'small' ? 'is-active' : ''} type="button" aria-label="Small icon view" aria-pressed={viewMode === 'small'} title="Small icons" onClick={() => setViewMode('small')}>
                <Mark name="gridSmall" />
              </button>
              <button className={viewMode === 'list' ? 'is-active' : ''} type="button" aria-label="List view" aria-pressed={viewMode === 'list'} title="List" onClick={() => setViewMode('list')}>
                <Mark name="listView" />
              </button>
            </div>
            <div className="files-toolbar-actions">
              <Button variant="ghost" size="sm" shape="pill" iconOnly icon="refresh" onClick={refresh} aria-label="Refresh" tooltip="Refresh" />
              {isDriveSection ? (
                <Button variant="ghost" size="sm" shape="pill" iconOnly icon="activity" onClick={() => void toggleActivity()} aria-label="Activity" aria-expanded={isActivityOpen} tooltip="Activity" />
              ) : null}
              <Button variant="ghost" size="sm" shape="pill" icon="back" onClick={onBack}>Studio</Button>
              {primaryAction}
            </div>
          </div>
        </header>

        {isViewOnlyAccount && isDriveSection ? (
          <Alert tone="info" className="files-access-note">
            This account can view its files here. Creating folders, moving and sharing aren’t available for this account type.
          </Alert>
        ) : null}

        <div className={`files-workarea ${isActivityOpen && isDriveSection ? 'with-activity' : ''}`}>
          <section className={`files-browser view-${viewMode}`} aria-label={locationLabel ?? sectionLabel}>
            <div className="files-list-heading">
              <span>Name</span><span>Updated</span><span>{section === 'links' ? 'Views' : 'Access'}</span><span className="sr-only">Actions</span>
            </div>
            <div className="files-browser-scroll">
              {isListLoading ? (
                <SkeletonGroup label={`Loading ${sectionLabel.toLowerCase()}…`} className="files-list">
                  {Array.from({ length: 8 }, (_, index) => <FileRowSkeleton key={index} index={index} />)}
                </SkeletonGroup>
              ) : itemCount ? (
                // Keyed by location, so moving to another section or folder replays the enter animation.
                <div className="files-list app-enter" key={`${section}:${currentFolderId ?? ''}:${openCollection?.id ?? ''}`}>
                  {section === 'library' ? libraryRows : section === 'links' ? linkRows : (
                    <>
                      {shownFolders.map(folderRow)}
                      {shownFiles.map(fileRow)}
                    </>
                  )}
                </div>
              ) : (
                <EmptyState
                  icon={searchTerm ? 'search' : SECTIONS.find((item) => item.id === section)?.icon ?? 'folder'}
                  headingLevel={2}
                  title={emptyCopy.title}
                  description={emptyCopy.description}
                  actions={searchTerm ? <Button shape="pill" onClick={() => setSearch('')}>Clear search</Button> : primaryAction ?? undefined}
                />
              )}
            </div>
          </section>

          {isActivityOpen && isDriveSection ? (
            <aside className="files-activity-panel app-enter-end" aria-label="Recent activity">
              <header><h2>Activity</h2><Button variant="ghost" size="sm" iconOnly icon="close" onClick={() => setIsActivityOpen(false)} aria-label="Close activity" /></header>
              {isLoadingActivity ? (
                <SkeletonGroup label="Loading activity…" className="files-activity-skeleton" stack>
                  {Array.from({ length: 3 }, (_, index) => <SkeletonText key={index} lines={3} />)}
                </SkeletonGroup>
              ) : activity.length ? (
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
        open={createTarget !== null}
        onClose={() => setCreateTarget(null)}
        title={createTarget === 'collection' ? 'New collection' : 'New folder'}
        description={createTarget === 'collection'
          ? 'Create a collection in the Library to upload laminates into.'
          : `Create a folder in ${section === 'files' ? currentFolder?.name ?? 'My Files' : 'My Files'}.`}
        size="sm"
        icon="folder"
        dismissible={!isCreating}
        onSubmit={(event) => void createItem(event)}
        footer={(
          <>
            <Button shape="pill" disabled={isCreating} onClick={() => setCreateTarget(null)}>Cancel</Button>
            <Button variant="primary" shape="pill" type="submit" disabled={!newName.trim()} loading={isCreating} loadingLabel="Creating…">
              {createTarget === 'collection' ? 'Create collection' : 'Create folder'}
            </Button>
          </>
        )}
      >
        <Field label={createTarget === 'collection' ? 'Collection name' : 'Folder name'}>
          <TextInput autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={120} required />
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
          {isLoadingMoveFolders ? (
            <SkeletonGroup label="Loading folders…" stack>
              <Skeleton variant="text" width={84} />
              <Skeleton height={38} />
            </SkeletonGroup>
          ) : (
            <Field label="Destination">
              <Select autoFocus value={moveDestination} onChange={(event) => setMoveDestination(event.target.value)}>
                <option value="">My Files</option>
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
          description="Folders inside it are deleted. Files move to My Files unless you choose to delete them too."
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

      {libraryDeleteTarget ? (
        <ConfirmDialog
          open
          tone="danger"
          title={`Delete ${libraryDeleteTarget.item.name}?`}
          description={libraryDeleteTarget.kind === 'collection'
            ? 'The collection and the laminates in it are removed from the Library.'
            : 'This laminate is removed from the Library.'}
          confirmLabel={libraryDeleteTarget.kind === 'collection' ? 'Delete collection' : 'Delete laminate'}
          loading={busyId === libraryDeleteTarget.item.id}
          loadingLabel="Deleting…"
          onConfirm={() => void confirmLibraryDelete()}
          onCancel={() => setLibraryDeleteTarget(null)}
        />
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
          {isLoadingShares ? (
            <SkeletonGroup label="Loading sharing…" stack>
              <Skeleton variant="text" width={72} />
              <Skeleton height={38} />
              <Skeleton variant="text" width={132} className="files-dialog-skeleton-heading" />
              <SkeletonText lines={2} />
              <Skeleton height={38} />
            </SkeletonGroup>
          ) : (
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
                    <Button size="sm" shape="pill" onClick={() => void copyLink(`${window.location.origin}/share/${encodeURIComponent(shareLinkTokenValue)}`)}>Copy</Button>
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
