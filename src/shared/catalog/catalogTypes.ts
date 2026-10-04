/** A collection in the laminate library; holds products the way a folder holds files. */
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
