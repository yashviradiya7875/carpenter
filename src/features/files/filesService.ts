import { callApi } from '../../shared/api/client'

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
    tool: firstString(record.tool),
    createdAt: firstString(record.createdAt),
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

export async function loadDriveFolderTree(username: string, options: RequestOptions = {}): Promise<DriveFolder[]> {
  const folders: DriveFolder[] = []
  const visited = new Set<string>()
  let pendingParents: Array<string | null> = [null]

  while (pendingParents.length) {
    const batch = pendingParents.splice(0, 8)
    const contents = await Promise.all(batch.map((parentId) => listDriveContents(username, parentId, '', false, options)))
    const nextParents: string[] = []

    contents.forEach((content) => {
      content.folders.forEach((folder) => {
        if (visited.has(folder.id)) return
        visited.add(folder.id)
        folders.push(folder)
        nextParents.push(folder.id)
      })
    })

    pendingParents = nextParents
  }

  return folders
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

export async function uploadDriveImage(username: string, file: File, folderId: string | null): Promise<DriveFile> {
  const imageUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error(`Could not read ${file.name}.`))
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`))
    reader.readAsDataURL(file)
  })

  const saved = await callApi<unknown, {
    username: string
    tool: string
    imageUrl: string
    baseImageUrl: null
    prompt: string
    settings: string
    creditsUsed: number
  }>('saveGeneration', {
    username,
    tool: 'CARPENTER',
    imageUrl,
    baseImageUrl: null,
    prompt: `Uploaded image: ${file.name}`,
    settings: JSON.stringify({ source: 'files-upload', originalName: file.name }),
    creditsUsed: 0,
  })

  const savedRecord = asRecord(saved)
  const nestedRecord = asRecord(savedRecord.generation)
  const fileId = firstString(savedRecord.generationId, savedRecord.id, nestedRecord.generationId, nestedRecord.id)
  if (!fileId) throw new Error(`The API saved ${file.name} without returning its file ID.`)

  const renamed = await renameDriveResource(username, fileId, 'file', file.name)
  if (!renamed.success) throw new Error(`${file.name} was saved but could not be renamed.`)

  if (folderId) {
    const moved = await moveDriveFile(username, fileId, folderId)
    if (!moved.success) throw new Error(`${file.name} was saved but could not be moved into this folder.`)
  }

  return {
    id: fileId,
    name: file.name,
    parentId: folderId,
    isFavorite: false,
    imageUrl,
    tool: 'CARPENTER',
    createdAt: new Date().toISOString(),
  }
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
