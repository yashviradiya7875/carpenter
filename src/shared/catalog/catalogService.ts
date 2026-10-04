import { ApiError, callApi, callApiMultipart } from '../api/client'
import type { Collection, Product, ProductDetails } from './catalogTypes'

/*
 * The laminate library (catalog): collections → products → images. Used by the studio to
 * pick a laminate and by Files to manage the library. The API decides who may upload.
 */

type UploadProductsResult = { success?: boolean; collection?: Collection; productsCreated?: number; products?: Product[] }

const LIBRARY_PAGE = { type: 'laminate', page: 1, pageSize: 40 } as const

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
