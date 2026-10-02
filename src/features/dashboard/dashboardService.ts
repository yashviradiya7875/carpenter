import { ApiError, callApi, callApiMultipart } from '../../shared/api/client'
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

/* ------------------------------------------------------------------- render */

/** Renders a primary laminate (and optional accent) onto a generated interior. */
export function generateCarpenterRender(username: string, primary: MaterialChoice, accent: MaterialChoice | null) {
  const data: Record<string, unknown> = {
    username,
    scene: {
      name: 'Contemporary interior',
      prompt: '',
    },
    prompt: '',
    creativeMode: false,
    decorateRoom: false,
    aspectRatio: '4:3',
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
