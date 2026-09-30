export type MaterialSlot = 'primary' | 'accent'
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

export type UploadTypeOption = {
  id: UploadType
  title: string
  description: string
  icon: 'image' | 'layers' | 'video'
}

export const UPLOAD_TYPES: UploadTypeOption[] = [
  { id: 'single', title: 'Single product', description: 'Create content for one product.', icon: 'image' },
  { id: 'multi', title: 'Multi product', description: 'Work with a group of products.', icon: 'layers' },
  { id: 'reel', title: 'Reel / video', description: 'Create a short-form video.', icon: 'video' },
]