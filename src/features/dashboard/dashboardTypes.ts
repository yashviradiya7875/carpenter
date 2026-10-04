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

/** Where the accent laminate goes on the room photo: a box in 0–1 fractions of its width and height. */
export type AccentRegion = { x: number; y: number; w: number; h: number }

/** A render with two materials, in the terms the render API takes. */
export type PlacementPlan = {
  /** Covers the furniture, apart from the accent regions. */
  primary: MaterialChoice
  accent: MaterialChoice
  /** Empty lets the renderer decide where the accent goes. */
  accentRegions: AccentRegion[]
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
