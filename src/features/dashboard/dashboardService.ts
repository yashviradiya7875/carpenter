import { API_BASE_URL, callApi } from '../../shared/api/client'
import type { RoomCategory, RoomScene, RoomSelection } from '../../shared/components/roomImage'
import type { AccentRegion, MaterialChoice } from './dashboardTypes'

type RequestOptions = { signal?: AbortSignal }

export type ShareStats = {
  total?: number
  uniqueClients?: number
  followUps?: { overdue?: number; dueToday?: number; upcoming?: number }
}

export type GenerationResult = { imageUrl?: string; generationId?: string }

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

// Shared with Files, which manages the same library.
export {
  deleteCollection,
  deleteProduct,
  getProduct,
  listCollectionProducts,
  listLaminateCollections,
} from '../../shared/catalog/catalogService'

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

/** The name a render's room is recorded under. */
export function roomName(room: RoomSelection | null): string {
  return room?.kind === 'scene' ? room.scene.name : room ? 'Custom room' : 'Contemporary interior'
}

/* ------------------------------------------------------------------- render */

/**
 * Renders a primary laminate (and optional accent) onto a room: a library scene,
 * the user's own photo, or - with no room - an interior the model invents.
 * `accentRegions` mark where the accent goes on a real room photo; without them the
 * renderer decides.
 */
export function generateCarpenterRender(
  username: string,
  primary: MaterialChoice,
  accent: MaterialChoice | null,
  room: RoomSelection | null = null,
  accentRegions: AccentRegion[] = [],
) {
  const data: Record<string, unknown> = {
    username,
    scene: { name: roomName(room), prompt: '' },
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
  if (accent && room && accentRegions.length) data.accentRegions = accentRegions
  return callApi<GenerationResult, Record<string, unknown>>('generateCarpenter', data)
}

/**
 * Saves a finished render to Files. The server keeps a render together with the laminate
 * it was made from (`baseImageUrl`) and refuses a Manufacturer save without one.
 * `creditsUsed` only labels the record with what the render cost; saving charges nothing.
 */
export function saveRenderToFiles(username: string, render: {
  imageUrl: string
  baseImageUrl?: string
  sceneName: string
  creditsUsed: number
}) {
  return callApi<unknown, {
    username: string; tool: string; imageUrl: string; baseImageUrl?: string; prompt: string; settings: string; creditsUsed: number
  }>('saveGeneration', {
    username,
    tool: 'CARPENTER',
    imageUrl: render.imageUrl,
    baseImageUrl: render.baseImageUrl,
    prompt: '',
    settings: JSON.stringify({ kind: 'render', sceneName: render.sceneName }),
    creditsUsed: render.creditsUsed,
  })
}

/* -------------------------------------------------------------------- share */

export type ShareClient = {
  id: string
  name: string
  whatsapp?: string
  /** `YYYY-MM-DD`. */
  followUpDate?: string
}

export type ShareChannel = 'device_share' | 'copy'

export type ShareAttempt = {
  /** An existing client; omit it and send `clientName` to create one. */
  clientId?: string
  clientName?: string
  whatsapp?: string
  followUpDate?: string
  generationId?: string
  outgoingMessage?: string
  channel: ShareChannel
  /** `cancelled` when the device share sheet was dismissed. */
  status: 'attempted' | 'cancelled'
}

/** The caller's own clients: the server refuses a share attempt against anyone else's. */
export async function listShareClients(username: string, options: RequestOptions = {}): Promise<ShareClient[]> {
  const result = await callApi<unknown, { username: string; limit: number }>('listShareClients', { username, limit: 100 }, options)
  const rows = Array.isArray(result) ? result : (result as { clients?: unknown } | null)?.clients
  const clients: ShareClient[] = []
  for (const item of Array.isArray(rows) ? rows : []) {
    const record = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>
    const id = text(record.id)
    const name = text(record.name)
    const owner = text(record.ownerUsername)
    if (!id || !name || (owner && owner.toLowerCase() !== username.toLowerCase())) continue
    clients.push({ id, name, whatsapp: text(record.whatsapp), followUpDate: text(record.followUpDate)?.slice(0, 10) })
  }
  return clients
}

/** Logs a share attempt (never a confirmed delivery) and creates or updates the client. */
export function recordShareAttempt(username: string, attempt: ShareAttempt) {
  return callApi<{ success?: boolean; attemptId?: string }, ShareAttempt & { username: string }>(
    'recordShareAttempt',
    { username, ...attempt },
  )
}
