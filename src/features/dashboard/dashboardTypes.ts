export type MaterialSlot = 'primary' | 'accent'
/** What an upload turns into: one render, one render per image, or a video reel. Detected from the files. */
export type UploadType = 'single' | 'multi' | 'reel'

export type MaterialChoice = {
  id: string
  name: string
  imageId?: string
  base64?: string
  mimeType?: string
  imageUrl?: string
  source: 'upload' | 'library'
}

export type Collection = { id: string; name: string; productCount?: number }
export type Product = {
  id: string
  name: string
  thumbUrl?: string
  coverThumbUrl?: string
  imageUrl?: string
}
export type ProductDetails = {
  product?: {
    id: string
    name: string
    images?: Array<{ id: string; url?: string; thumbUrl?: string }>
  }
}
