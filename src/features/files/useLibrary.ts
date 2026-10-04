import { useEffect, useRef, useState } from 'react'
import { listCollectionProducts, listLaminateCollections } from '../../shared/catalog/catalogService'
import type { Collection, Product } from '../../shared/catalog/catalogTypes'

/**
 * The laminate library as Files shows it: collections like folders, and the laminates
 * inside the open one. Loads only while `enabled` (the Library section is showing);
 * `search` is passed to the API, which searches collections or the open collection.
 */
export function useLibrary(username: string, enabled: boolean, search: string, onError: (error: unknown) => void) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [openCollection, setOpenCollection] = useState<Collection | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const openId = openCollection?.id ?? null
  // Only reports; a new function each render must not refetch.
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  })

  useEffect(() => {
    if (!enabled) return
    let isCurrent = true
    const timer = window.setTimeout(() => {
      setIsLoading(true)
      const request = openId
        ? listCollectionProducts(username, openId, search).then((items) => { if (isCurrent) setProducts(items) })
        : listLaminateCollections(username, search).then((items) => { if (isCurrent) setCollections(items) })
      request
        .catch((error: unknown) => { if (isCurrent) onErrorRef.current(error) })
        .finally(() => { if (isCurrent) setIsLoading(false) })
    }, search ? 220 : 0)

    return () => {
      isCurrent = false
      window.clearTimeout(timer)
    }
  }, [enabled, openId, reloadKey, search, username])

  return {
    collections,
    products,
    openCollection,
    isLoading,
    /** Opens a collection, or returns to the list of collections with `null`. */
    open: (collection: Collection | null) => {
      setProducts([])
      setOpenCollection(collection)
    },
    reload: () => setReloadKey((value) => value + 1),
  }
}
