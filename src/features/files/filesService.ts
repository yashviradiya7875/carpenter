import { API_BASE_URL, callApi } from '../../shared/api/client'

export type DriveRole = 'owner' | 'admin' | 'editor' | 'viewer'
export type DriveResourceType = 'file' | 'folder'

export type DriveFolder = {
  id: string
  name: string
  parentId: string | null
  myRole?: string
  isFavorite: boolean
  visibility?: string
  updatedAt?: string
}

export type DriveFile = {
  id: string
  name: string
  parentId: string | null
  myRole?: string
  isFavorite: boolean
  imageUrl?: string
  /** Small preview of `imageUrl`, when the record has one. */
  thumbUrl?: string
  /** The laminate texture a render was made from. */
  baseImageUrl?: string
  visibility?: string
  /** Saved as an uploaded image rather than produced by a render. */
  isUpload: boolean
  tool?: string
  createdAt?: string
  updatedAt?: string
}

export type DriveContents = { folders: DriveFolder[]; files: DriveFile[] }

type RequestOptions = { signal?: AbortSignal }

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string' && value.length > 0)
}

function normalizeFolder(value: unknown, parentId: string | null = null): DriveFolder | null {
  const record = asRecord(value)
  const id = firstString(record.id, record.folderId)
  if (!id) return null

  return {
    id,
    name: firstString(record.name, record.title) ?? 'Untitled folder',
    parentId: firstString(record.parentId) ?? parentId,
    myRole: firstString(record.myRole, record.role),
    isFavorite: record.isFavorite === true || record.favorite === true,
    visibility: firstString(record.visibility),
    updatedAt: firstString(record.updatedAt, record.createdAt),
  }
}

/** A URL an <img> can still load; `blob:` URLs written by another session are dead. */
function displayableUrl(value: unknown): string | undefined {
  const url = firstString(value)
  return url && /^(https?:|data:image\/|\/)/i.test(url) ? url : undefined
}

/** How a record came to exist, from its `settings` JSON (`files-upload` for images uploaded to Files). */
function settingsSource(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined
  try {
    return firstString(asRecord(JSON.parse(value)).source)
  } catch {
    return undefined
  }
}

function normalizeFile(value: unknown, parentId: string | null = null): DriveFile | null {
  const record = asRecord(value)
  const id = firstString(record.generationId, record.id, record.fileId)
  if (!id) return null

  return {
    id,
    name: firstString(record.name, record.title, record.fileName) ?? 'Saved render',
    parentId: firstString(record.folderId, record.parentId) ?? parentId,
    myRole: firstString(record.myRole, record.role),
    isFavorite: record.isFavorite === true || record.favorite === true,
    imageUrl: firstString(record.imageUrl, record.url, record.thumbnailUrl, record.thumbUrl),
    thumbUrl: firstString(record.thumbUrl, record.thumbnailUrl),
    baseImageUrl: displayableUrl(record.baseImageUrl),
    visibility: firstString(record.visibility),
    isUpload: settingsSource(record.settings) === 'files-upload',
    tool: firstString(record.tool),
    createdAt: firstString(record.createdAt) ?? (typeof record.timestamp === 'number' ? new Date(record.timestamp).toISOString() : undefined),
    updatedAt: firstString(record.updatedAt),
  }
}

export async function listDriveContents(
  username: string,
  parentId: string | null,
  search = '',
  favoritesOnly = false,
  options: RequestOptions = {},
): Promise<DriveContents> {
  const result = await callApi<{ folders?: unknown[]; files?: unknown[] }, {
    username: string
    parentId: string | null
    search: string
    favoritesOnly: boolean
  }>('getFileSystem', { username, parentId, search, favoritesOnly }, options)

  return {
    folders: (Array.isArray(result.folders) ? result.folders : [])
      .map((folder) => normalizeFolder(folder, parentId))
      .filter((folder): folder is DriveFolder => folder !== null),
    files: (Array.isArray(result.files) ? result.files : [])
      .map((file) => normalizeFile(file, parentId))
      .filter((file): file is DriveFile => file !== null),
  }
}

/**
 * Everything in the user's Files, by walking the folders from Home: every folder (for the
 * folder tree and Move) and every file (for All Assets, Recent, Favorites, Shared, Renders
 * and Sources, which the API has no listing of their own for).
 */
export async function loadDriveIndex(username: string, options: RequestOptions = {}): Promise<DriveContents> {
  const folders: DriveFolder[] = []
  const files: DriveFile[] = []
  const visitedFolders = new Set<string>()
  const seenFiles = new Set<string>()
  let pendingParents: Array<string | null> = [null]

  while (pendingParents.length) {
    const batch = pendingParents.splice(0, 8)
    const contents = await Promise.all(batch.map((parentId) => listDriveContents(username, parentId, '', false, options)))
    const nextParents: string[] = []

    contents.forEach((content) => {
      content.folders.forEach((folder) => {
        if (visitedFolders.has(folder.id)) return
        visitedFolders.add(folder.id)
        folders.push(folder)
        nextParents.push(folder.id)
      })
      content.files.forEach((file) => {
        if (seenFiles.has(file.id)) return
        seenFiles.add(file.id)
        files.push(file)
      })
    })

    pendingParents = nextParents
  }

  return { folders, files }
}

export async function createDriveFolder(username: string, name: string, parentId: string | null): Promise<DriveFolder> {
  const result = await callApi<unknown, { username: string; name: string; parentId: string | null }>(
    'createFolder',
    { username, name, parentId },
  )
  const record = asRecord(result)
  const folder = normalizeFolder(record.folder ?? result, parentId)
  if (!folder) throw new Error('The API did not return the created folder.')
  return folder
}

export function renameDriveResource(username: string, resourceId: string, resourceType: DriveResourceType, newName: string) {
  return callApi<{ success: boolean }, { username: string; resourceId: string; resourceType: DriveResourceType; newName: string }>(
    'renameResource',
    { username, resourceId, resourceType, newName },
  )
}

export function moveDriveFile(username: string, fileId: string, folderId: string | null) {
  return callApi<{ success: boolean }, { username: string; fileId: string; folderId: string | null }>(
    'moveFile',
    { username, fileId, folderId },
  )
}

export function moveDriveFolder(username: string, folderId: string, newParentId: string | null) {
  return callApi<{ success: boolean }, { username: string; folderId: string; newParentId: string | null }>(
    'moveFolder',
    { username, folderId, newParentId },
  )
}

export function toggleDriveFavorite(username: string, resourceId: string, resourceType: DriveResourceType) {
  return callApi<{ success: boolean; isFavorite: boolean }, {
    username: string; resourceId: string; resourceType: DriveResourceType
  }>('toggleFavorite', { username, resourceId, resourceType })
}

export function shareDriveResource(username: string, resourceId: string, resourceType: DriveResourceType, data: {
  visibility: 'private' | 'organization' | 'public'
  permissions: Record<string, DriveRole>
  sharedWith: string[]
}) {
  return callApi<{ success: boolean }, {
    username: string
    resourceId: string
    resourceType: DriveResourceType
    visibility: 'private' | 'organization' | 'public'
    permissions: Record<string, DriveRole>
    sharedWith: string[]
  }>('shareResource', { username, resourceId, resourceType, ...data })
}

export function getDriveResourceShares(username: string, resourceId: string, resourceType: DriveResourceType) {
  return callApi<unknown, { username: string; resourceId: string; resourceType: DriveResourceType }>(
    'getResourceShares',
    { username, resourceId, resourceType },
  )
}

export function createDriveShareLink(username: string, resourceId: string, resourceType: DriveResourceType, linkRole: DriveRole) {
  return callApi<{ token: string; role: DriveRole }, {
    username: string; resourceId: string; resourceType: DriveResourceType; linkRole: DriveRole
  }>('createShareLink', { username, resourceId, resourceType, linkRole })
}

export function revokeDriveShareLink(username: string, token: string) {
  return callApi<{ success: boolean }, { username: string; token: string }>('revokeShareLink', { username, token })
}

export function getSharedDriveResource(token: string, options: RequestOptions = {}) {
  return callApi<{ resource?: unknown; resourceType?: string; role?: string }, { token: string }>(
    'getSharedResource',
    { token },
    options,
  )
}

export function getDriveActivity(username: string, resourceId: string | null) {
  return callApi<{ activity?: unknown[] }, { username: string; resourceId: string | null; limit: number; kind: null }>(
    'getActivity',
    { username, resourceId, limit: 50, kind: null },
  )
}

export function deleteDriveFolder(username: string, folderId: string, deleteFiles: boolean) {
  return callApi<{ success: boolean; foldersDeleted?: number }, {
    username: string; folderId: string; deleteFiles: boolean
  }>('deleteFolder', { username, folderId, deleteFiles })
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function getString(value: unknown, ...keys: string[]): string | undefined {
  if (!isRecord(value)) return undefined
  return firstString(...keys.map((key) => value[key]))
}

/* ------------------------------------------------------------------ sharing */

export type ShareDraft = {
  visibility: 'private' | 'organization' | 'public'
  permissions: Record<string, DriveRole>
}

const DRIVE_ROLES: DriveRole[] = ['owner', 'admin', 'editor', 'viewer']

/** Normalizes a getResourceShares response (several legacy shapes) into an editable draft. */
export function asShareDraft(value: unknown): ShareDraft {
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

/** Finds the active share-link token in a getResourceShares response, if any. */
export function shareLinkToken(value: unknown): string | null {
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

/* ------------------------------------------------------------- render links */

/** A public page for a finished render (`/p/<token>`), created when a render is published. */
export type RenderLink = {
  token: string
  url: string
  title: string
  views: number
  revoked: boolean
  createdAt?: string
}

export async function listRenderLinks(username: string, options: RequestOptions = {}): Promise<RenderLink[]> {
  const result = await callApi<{ links?: unknown[] }, { username: string; page: number; pageSize: number }>(
    'listProductLinks',
    { username, page: 1, pageSize: 40 },
    options,
  )
  const links: RenderLink[] = []
  for (const item of Array.isArray(result.links) ? result.links : []) {
    const record = asRecord(item)
    const token = firstString(record.token)
    if (!token) continue
    const url = firstString(record.url) ?? ''
    links.push({
      token,
      // The link may come back relative to the API origin.
      url: url.startsWith('/') ? `${API_BASE_URL}${url}` : url,
      title: firstString(record.title) ?? 'Render link',
      views: typeof record.views === 'number' ? record.views : 0,
      revoked: record.revoked === true,
      createdAt: firstString(record.createdAt),
    })
  }
  return links
}

/** Disables a render link, or enables it again. */
export function setRenderLinkRevoked(username: string, token: string, revoked: boolean) {
  return callApi<{ success: boolean; revoked?: boolean }, { username: string; token: string; revoked: boolean }>(
    'revokeProductLink',
    { username, token, revoked },
  )
}
