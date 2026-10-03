import { API_BASE_URL, ApiError, callApi, callApiMultipart } from '../../shared/api/client'
import type { RoomCategory, RoomScene, RoomSelection } from '../../shared/components/roomImage'
import type { Collection, MaterialChoice, Product, ProductDetails } from './dashboardTypes'

type RequestOptions = { signal?: AbortSignal }

export type ShareStats = {
  total?: number
  uniqueClients?: number
  followUps?: { overdue?: number; dueToday?: number; upcoming?: number }
}

export type GenerationResult = { imageUrl?: string; generationId?: string }

type UploadProductsResult = { success?: boolean; collection?: Collection; productsCreated?: number; products?: Product[] }

const LIBRARY_PAGE = { type: 'laminate', page: 1, pageSize: 40 } as const

export function getShareStats(username: string, options: RequestOptions = {}) {
  return callApi<ShareStats, { username: string }>('getShareStats', { username }, options)
}

export async function getUserCredits(username: string): Promise<number | null> {
  const result = await callApi<{ credits: number }, { username: string }>('getUserCredits', { username })
  return typeof result.credits === 'number' ? result.credits : null
}

/**
 * Credits the server charged for this account's most recent paid render.
 *
 * The server prices a render when it runs (by the account's resolution tier) and the
 * API has no price lookup, so the last real charge is the only source for the cost
 * shown before generating. Never compute or hardcode prices here.
 * Resolves null when the account has no paid render yet.
 */
export async function getLastRenderCost(username: string, options: RequestOptions = {}): Promise<number | null> {
  const records = await callApi<unknown, { callerUsername: string; filterUsername: string; limit: number }>(
    'getGenerations',
    { callerUsername: username, filterUsername: username, limit: 20 },
    options,
  )
  if (!Array.isArray(records)) return null
  for (const record of records) {
    // Newest first. Files uploads are saved as generations with creditsUsed 0; skip them.
    const charged = typeof record === 'object' && record !== null ? (record as { creditsUsed?: unknown }).creditsUsed : undefined
    if (typeof charged === 'number' && charged > 0) return charged
  }
  return null
}

/* ----------------------------------------------------------- laminate library */

export async function listLaminateCollections(username: string, search: string): Promise<Collection[]> {
  const result = await callApi<{ collections: Collection[] }, {
    username: string; type: string; page: number; pageSize: number; search: string
  }>('listCollections', { username, ...LIBRARY_PAGE, search })
  return result.collections ?? []
}

export async function listCollectionProducts(username: string, collectionId: string, search: string): Promise<Product[]> {
  const result = await callApi<{ products: Product[] }, {
    username: string; collectionId: string; type: string; page: number; pageSize: number; search: string
  }>('listProducts', { username, collectionId, ...LIBRARY_PAGE, search })
  return result.products ?? []
}

export function getProduct(username: string, productId: string) {
  return callApi<ProductDetails, { username: string; productId: string }>('getProduct', { username, productId })
}

export function createLaminateCollection(username: string, name: string) {
  return callApi<Collection, { username: string; name: string; type: string; description: string; isShared: boolean }>(
    'createCollection',
    { username, name, type: 'laminate', description: 'Created from Carpenter Pro library', isShared: false },
  )
}

export async function deleteProduct(username: string, productId: string): Promise<void> {
  const result = await callApi<{ success: boolean }, { username: string; productId: string }>('deleteProduct', { username, productId })
  if (!result.success) throw new ApiError('The product could not be deleted.')
}

export async function deleteCollection(username: string, collectionId: string): Promise<void> {
  const result = await callApi<{ success: boolean }, { username: string; collectionId: string }>('deleteCollection', { username, collectionId })
  if (!result.success) throw new ApiError('The collection could not be deleted.')
}

/** Bulk upload; folder uploads keep their relative paths so each folder becomes one laminate. */
export function uploadLaminateProducts(username: string, collectionId: string, files: File[]) {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))
  formData.append('collectionId', collectionId)
  formData.append('type', 'laminate')
  formData.append('autoPublish', '1')
  formData.append('paths', JSON.stringify(files.map((file) => {
    const fileWithPath = file as File & { webkitRelativePath?: string }
    return fileWithPath.webkitRelativePath || file.name
  })))
  formData.append('username', username)
  return callApiMultipart<UploadProductsResult>('uploadProducts', formData)
}

/* -------------------------------------------------------------------- rooms */

export type RoomLibrary = { categories: RoomCategory[]; scenes: RoomScene[] }

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** Image URLs may come back relative to the API origin. */
function mediaUrl(value: unknown): string | undefined {
  const url = text(value)
  return url?.startsWith('/') ? `${API_BASE_URL}${url}` : url
}

/** Predefined rooms a laminate can be rendered onto, grouped by category. */
export async function listCarpenterScenes(username: string, options: RequestOptions = {}): Promise<RoomLibrary> {
  const result = await callApi<{ categories?: unknown; scenes?: unknown }, { username: string; category: null; includeHidden: boolean }>(
    'listCarpenterScenes',
    { username, category: null, includeHidden: false },
    options,
  )

  const scenes: RoomScene[] = []
  const sceneCategoryLabels = new Map<string, string>()
  for (const item of Array.isArray(result.scenes) ? result.scenes : []) {
    const record = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>
    const id = text(record.id)
    if (!id) continue
    const category = text(record.category)
    if (category && !sceneCategoryLabels.has(category)) sceneCategoryLabels.set(category, text(record.categoryLabel) ?? category)
    scenes.push({
      id,
      name: text(record.name) ?? 'Room',
      category: text(record.category) ?? '',
      aspectRatio: text(record.aspectRatio),
      imageUrl: mediaUrl(record.imageUrl),
      thumbUrl: mediaUrl(record.thumbUrl),
    })
  }

  const categories: RoomCategory[] = []
  for (const item of Array.isArray(result.categories) ? result.categories : []) {
    const record = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>
    const id = text(record.id)
    // Only categories that actually have rooms to pick.
    if (id && scenes.some((scene) => scene.category === id)) {
      categories.push({ id, label: text(record.label) ?? id, count: typeof record.count === 'number' ? record.count : undefined })
    }
  }
  // Each scene also names its category (`categoryLabel`); use that if the list above is missing.
  if (!categories.length) {
    sceneCategoryLabels.forEach((label, id) => categories.push({ id, label }))
  }
  return { categories, scenes }
}

/* ------------------------------------------------------------------- render */

/**
 * Renders a primary laminate (and optional accent) onto a room: a library scene,
 * the user's own photo, or - with no room - an interior the model invents.
 */
export function generateCarpenterRender(
  username: string,
  primary: MaterialChoice,
  accent: MaterialChoice | null,
  room: RoomSelection | null = null,
) {
  const data: Record<string, unknown> = {
    username,
    scene: {
      name: room?.kind === 'scene' ? room.scene.name : room ? 'Custom room' : 'Contemporary interior',
      prompt: '',
    },
    prompt: '',
    creativeMode: false,
    decorateRoom: false,
  }
  if (room?.kind === 'scene') {
    // The server reads the scene image itself and defaults to the scene's own ratio.
    data.sceneId = room.scene.id
  } else if (room?.kind === 'custom') {
    data.sceneImageBase64 = room.room.base64
    data.sceneImageMimeType = room.room.mimeType
    data.aspectRatio = room.room.aspectRatio
  } else {
    data.aspectRatio = '4:3'
  }
  if (primary.imageId) data.laminateImageId = primary.imageId
  else {
    data.laminateBase64 = primary.base64
    data.laminateMimeType = primary.mimeType
  }
  if (accent?.imageId) data.accentLaminateImageId = accent.imageId
  else if (accent?.base64) {
    data.accentLaminateBase64 = accent.base64
    data.accentLaminateMimeType = accent.mimeType
  }
  return callApi<GenerationResult, Record<string, unknown>>('generateCarpenter', data)
}
